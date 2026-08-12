package br.com.axecloud.app.core.session

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton
import br.com.axecloud.app.feature.notifications.NotificationSyncScheduler

@Singleton
class SessionStore @Inject constructor(
    @ApplicationContext private val context: Context,
    private val cipher: TokenCipher,
) {
    private val preferences = context.getSharedPreferences("axecloud_secure_session", Context.MODE_PRIVATE)
    private val mutableSession = MutableStateFlow(read())
    val session: StateFlow<SessionSnapshot> = mutableSession.asStateFlow()

    fun current(): SessionSnapshot = mutableSession.value

    fun save(snapshot: SessionSnapshot) {
        preferences.edit()
            .putString(KEY_ACCESS, cipher.encrypt(snapshot.accessToken))
            .putString(KEY_REFRESH, cipher.encrypt(snapshot.refreshToken))
            .putString(KEY_USER, snapshot.userId)
            .putString(KEY_EMAIL, snapshot.email)
            .putString(KEY_ROLE, snapshot.role)
            .putString(KEY_TENANT, snapshot.tenantId)
            .putString(KEY_HOUSE, snapshot.houseName)
            .putString(KEY_PLAN, snapshot.plan)
            .putString(KEY_PHOTO, snapshot.profilePhotoUrl)
            .putLong(KEY_EXPIRES, snapshot.expiresAtEpochSeconds)
            .apply()
        mutableSession.value = snapshot
        NotificationSyncScheduler.kick(context)
    }

    fun clear() {
        preferences.edit().clear().apply()
        mutableSession.value = SessionSnapshot()
        NotificationSyncScheduler.cancelPending(context)
    }

    private fun read(): SessionSnapshot = SessionSnapshot(
        accessToken = cipher.decrypt(preferences.getString(KEY_ACCESS, "").orEmpty()),
        refreshToken = cipher.decrypt(preferences.getString(KEY_REFRESH, "").orEmpty()),
        userId = preferences.getString(KEY_USER, "").orEmpty(),
        email = preferences.getString(KEY_EMAIL, "").orEmpty(),
        role = preferences.getString(KEY_ROLE, "").orEmpty(),
        tenantId = preferences.getString(KEY_TENANT, "").orEmpty(),
        houseName = preferences.getString(KEY_HOUSE, "").orEmpty(),
        plan = preferences.getString(KEY_PLAN, "").orEmpty(),
        profilePhotoUrl = preferences.getString(KEY_PHOTO, "").orEmpty(),
        expiresAtEpochSeconds = preferences.getLong(KEY_EXPIRES, 0),
    )

    private companion object {
        const val KEY_ACCESS = "access"
        const val KEY_REFRESH = "refresh"
        const val KEY_USER = "user"
        const val KEY_EMAIL = "email"
        const val KEY_ROLE = "role"
        const val KEY_TENANT = "tenant"
        const val KEY_HOUSE = "house"
        const val KEY_PLAN = "plan"
        const val KEY_PHOTO = "photo"
        const val KEY_EXPIRES = "expires"
    }
}
