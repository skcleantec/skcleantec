package com.cbiseo.app.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object StaffFcmRegistrar {
    const val CHANNEL_DEFAULT = "cbiseo_staff_default"

    fun ensureChannels(context: android.content.Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_DEFAULT,
                "청소비서 알림",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "배정·메시지·업무 알림"
            },
        )
    }

    /**
     * Android 13+ 알림 권한 — Activity가 화면에 떠 있는 상태(resumed)에서 호출해야 팝업이 뜬다.
     * [permissionLauncher]는 Activity.registerForActivityResult(RequestPermission()) 로 등록.
     */
    fun requestPermissionAndRegister(
        activity: ComponentActivity,
        permissionLauncher: ActivityResultLauncher<String>,
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
        registerToken(activity)
    }

    fun registerToken(context: android.content.Context) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) return@addOnCompleteListener
            val token = task.result ?: return@addOnCompleteListener
            CoroutineScope(Dispatchers.Main).launch {
                StaffPushApi.registerToken(context, token)
            }
        }
    }
}
