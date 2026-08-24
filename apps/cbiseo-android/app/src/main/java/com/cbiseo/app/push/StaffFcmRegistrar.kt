package com.cbiseo.app.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object StaffFcmRegistrar {
    const val CHANNEL_DEFAULT = "cbiseo_staff_default"
    private const val TAG = "StaffFcmRegistrar"

    fun ensureChannels(context: android.content.Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val existing = manager.getNotificationChannel(CHANNEL_DEFAULT)
        if (existing != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_DEFAULT,
                "청소비서 알림",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "배정·메시지·업무 알림"
                enableVibration(true)
            },
        )
    }

    /**
     * Android 13+ 알림 권한 — Activity resumed 상태에서 호출.
     * FCM 토큰 등록과 분리: Firebase 문서상 토큰은 권한 없이도 발급·등록 가능.
     */
    fun requestPermissionIfNeeded(
        activity: ComponentActivity,
        permissionLauncher: ActivityResultLauncher<String>,
        onFinished: () -> Unit = {},
    ) {
        ensureChannels(activity.applicationContext)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }
        onFinished()
    }

    /** FCM 토큰 → POST /api/push/staff-app/register (알림 권한과 무관하게 호출) */
    fun registerToken(context: android.content.Context) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w(TAG, "FCM token fetch failed", task.exception)
                return@addOnCompleteListener
            }
            val token = task.result?.trim().orEmpty()
            if (token.length < 20) {
                Log.w(TAG, "FCM token empty or too short")
                return@addOnCompleteListener
            }
            Log.i(TAG, "FCM token fetched (${token.length} chars), registering with server…")
            CoroutineScope(Dispatchers.Main).launch {
                StaffPushApi.registerToken(context, token)
            }
        }
    }
}
