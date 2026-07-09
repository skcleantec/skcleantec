package com.skcleantec.telecrm.service

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.net.toUri

/** 갤럭시·Android 14+ — full-screen 알림·배터리 최적화 안내 */
object TelecrmDeviceHints {
    fun canUseFullScreenIntent(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val nm = context.getSystemService(android.app.NotificationManager::class.java) ?: return false
        return nm.canUseFullScreenIntent()
    }

    fun openFullScreenIntentSettings(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                data = "package:${context.packageName}".toUri()
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            runCatching { context.startActivity(intent) }
        }
    }

    fun openBatteryOptimizationSettings(context: Context) {
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { context.startActivity(intent) }
            .onFailure {
                val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", context.packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                runCatching { context.startActivity(fallback) }
            }
    }

    fun shouldPromptFullScreenIntent(context: Context): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !canUseFullScreenIntent(context)

    fun areNotificationsEnabled(context: Context): Boolean =
        NotificationManagerCompat.from(context).areNotificationsEnabled()
}
