package br.com.axecloud.app.feature.notifications

import android.content.Context

internal data class NativeNotificationPreferences(
    val finance: Boolean = true,
    val agenda: Boolean = true,
    val notices: Boolean = true,
    val routine: Boolean = true,
    val management: Boolean = true,
) {
    fun allows(category: String): Boolean = when (category) {
        "payment" -> finance
        "event" -> agenda
        "info" -> notices
        "precept" -> routine
        "prayer", "inventory" -> management
        else -> true
    }
}

internal object NotificationPreferencesStore {
    private const val NAME = "axecloud_notification_preferences"

    fun read(context: Context): NativeNotificationPreferences = context.getSharedPreferences(NAME, Context.MODE_PRIVATE).run {
        NativeNotificationPreferences(
            finance = getBoolean("finance", true),
            agenda = getBoolean("agenda", true),
            notices = getBoolean("notices", true),
            routine = getBoolean("routine", true),
            management = getBoolean("management", true),
        )
    }

    fun save(context: Context, value: NativeNotificationPreferences) {
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE).edit()
            .putBoolean("finance", value.finance)
            .putBoolean("agenda", value.agenda)
            .putBoolean("notices", value.notices)
            .putBoolean("routine", value.routine)
            .putBoolean("management", value.management)
            .apply()
    }
}
