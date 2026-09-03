package com.skcleantec.telecrm.setup

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.service.TelecrmDeviceHints
import com.skcleantec.telecrm.telephony.TelecrmCallScreeningSetup

enum class TelecrmSetupKind {
    PHONE,
    CALL_LOG,
    NOTIFICATION,
    FULL_SCREEN,
    BATTERY,
    CALL_SCREENING,
}

data class TelecrmSetupItem(
    val kind: TelecrmSetupKind,
    val titleRes: Int,
    val hintRes: Int,
    val done: Boolean,
)

object TelecrmRequiredSetup {
    fun items(context: Context): List<TelecrmSetupItem> {
        val list = mutableListOf<TelecrmSetupItem>()
        list.add(
            TelecrmSetupItem(
                TelecrmSetupKind.PHONE,
                R.string.setup_item_phone,
                R.string.setup_item_phone_hint,
                hasPhonePermissions(context),
            ),
        )
        list.add(
            TelecrmSetupItem(
                TelecrmSetupKind.CALL_LOG,
                R.string.setup_item_call_log,
                R.string.setup_item_call_log_hint,
                hasPermission(context, Manifest.permission.READ_CALL_LOG),
            ),
        )
        list.add(
            TelecrmSetupItem(
                TelecrmSetupKind.NOTIFICATION,
                R.string.setup_item_notification,
                R.string.setup_item_notification_hint,
                hasNotificationAccess(context),
            ),
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            list.add(
                TelecrmSetupItem(
                    TelecrmSetupKind.FULL_SCREEN,
                    R.string.setup_item_fullscreen,
                    R.string.setup_item_fullscreen_hint,
                    TelecrmDeviceHints.canUseFullScreenIntent(context),
                ),
            )
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            list.add(
                TelecrmSetupItem(
                    TelecrmSetupKind.BATTERY,
                    R.string.setup_item_battery,
                    R.string.setup_item_battery_hint,
                    TelecrmDeviceHints.isIgnoringBatteryOptimizations(context),
                ),
            )
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            list.add(
                TelecrmSetupItem(
                    TelecrmSetupKind.CALL_SCREENING,
                    R.string.setup_item_call_screening,
                    R.string.setup_item_call_screening_hint,
                    TelecrmCallScreeningSetup.isRoleHeld(context),
                ),
            )
        }
        return list
    }

    fun isComplete(context: Context): Boolean = items(context).all { it.done }

    fun runtimePermissionsNeeded(context: Context): List<String> {
        val needed = mutableListOf<String>()
        if (!hasPermission(context, Manifest.permission.CALL_PHONE)) needed.add(Manifest.permission.CALL_PHONE)
        if (!hasPermission(context, Manifest.permission.READ_PHONE_STATE)) needed.add(Manifest.permission.READ_PHONE_STATE)
        if (!hasPermission(context, Manifest.permission.READ_CALL_LOG)) needed.add(Manifest.permission.READ_CALL_LOG)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !hasPermission(context, Manifest.permission.ANSWER_PHONE_CALLS)
        ) {
            needed.add(Manifest.permission.ANSWER_PHONE_CALLS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !hasPermission(context, Manifest.permission.READ_PHONE_NUMBERS)
        ) {
            needed.add(Manifest.permission.READ_PHONE_NUMBERS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !hasPermission(context, Manifest.permission.POST_NOTIFICATIONS)
        ) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        return needed
    }

    private fun hasPhonePermissions(context: Context): Boolean {
        if (!hasPermission(context, Manifest.permission.CALL_PHONE)) return false
        if (!hasPermission(context, Manifest.permission.READ_PHONE_STATE)) return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !hasPermission(context, Manifest.permission.ANSWER_PHONE_CALLS)
        ) {
            return false
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !hasPermission(context, Manifest.permission.READ_PHONE_NUMBERS)
        ) {
            return false
        }
        return true
    }

    private fun hasNotificationAccess(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !hasPermission(context, Manifest.permission.POST_NOTIFICATIONS)
        ) {
            return false
        }
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(NotificationManager::class.java) ?: return true
            val incoming = nm.getNotificationChannel("telecrm_incoming_call")
            if (incoming != null && incoming.importance == NotificationManager.IMPORTANCE_NONE) return false
        }
        return true
    }

    private fun hasPermission(context: Context, permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
}
