package br.com.axecloud.app.feature.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.hilt.work.HiltWorker
import androidx.work.*
import br.com.axecloud.app.MainActivity
import br.com.axecloud.app.R
import br.com.axecloud.app.feature.auth.AuthRepository
import br.com.axecloud.app.feature.auth.AuthResult
import br.com.axecloud.app.feature.home.HomeRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

@HiltWorker
class NotificationSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val auth: AuthRepository,
    private val home: HomeRepository,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return Result.success()
        val session = home.session()
        if (!session.isAuthenticated) return Result.success()
        val restored = auth.restore()
        if (restored is AuthResult.Error) return Result.retry()
        return runCatching {
            val snapshot = home.load()
            val preferences = NotificationPreferencesStore.read(applicationContext)
            val candidates = backgroundNotifications(snapshot).filter { preferences.allows(it.category) }
            val prefs = applicationContext.getSharedPreferences(PREFS_BACKGROUND, Context.MODE_PRIVATE)
            val scope = "${snapshot.houseName}:${session.userId}"
            val previous = prefs.getStringSet(scope, emptySet()).orEmpty()
            val unseen = candidates.filter { it.id !in previous }.take(3)
            createChannel()
            unseen.forEach(::notify)
            prefs.edit().putStringSet(scope, (previous + candidates.map { it.id }).toList().takeLast(200).toSet()).apply()
            Result.success()
        }.getOrElse { Result.retry() }
    }

    private fun createChannel() {
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Pendências da casa", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "Giras, mensalidades, avisos e movimentos que pedem atenção"
        })
    }

    private fun notify(item: BackgroundNotification) {
        if (ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(MainActivity.EXTRA_NOTIFICATION_TARGET, item.target)
        }
        val pending = PendingIntent.getActivity(applicationContext, item.id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFF173C2B.toInt())
            .setContentTitle(item.title)
            .setContentText(item.body.ifBlank { "Abra o AxéCloud para acompanhar." })
            .setStyle(NotificationCompat.BigTextStyle().bigText(item.body))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .build()
        try {
            NotificationManagerCompat.from(applicationContext).notify(item.id.hashCode(), notification)
        } catch (_: SecurityException) {
            // A permissão pode ser revogada entre a sincronização e a publicação.
        }
    }

    private companion object {
        const val CHANNEL_ID = "axecloud_house_updates"
        const val PREFS_BACKGROUND = "axecloud_background_notifications"
    }
}

object NotificationSyncScheduler {
    private const val PERIODIC_NAME = "axecloud-notification-sync"
    private const val ONCE_NAME = "axecloud-notification-kick"

    fun schedule(context: Context) {
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val request = PeriodicWorkRequestBuilder<NotificationSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
    }

    fun kick(context: Context) {
        val request = OneTimeWorkRequestBuilder<NotificationSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(ONCE_NAME, ExistingWorkPolicy.REPLACE, request)
    }
}
