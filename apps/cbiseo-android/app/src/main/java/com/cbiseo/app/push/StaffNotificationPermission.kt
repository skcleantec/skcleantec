package com.cbiseo.app.push

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.core.content.ContextCompat
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 앱 실행 직후(로그인 전·후 공통) 알림 권한 — 계정·WebView URL과 무관.
 * 한 번 프로세스에서 요청 후, 로그인 화면→업무 화면 전환 시 중복 팝업 방지.
 */
object StaffNotificationPermission {
    private val promptedThisProcess = AtomicBoolean(false)

    fun isGranted(activity: ComponentActivity): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasPromptedThisProcess(): Boolean = promptedThisProcess.get()

    /** 앱 실행 직후 — 미허용이면 시스템 권한 창 (프로세스당 1회) */
    fun promptOnAppOpen(
        activity: ComponentActivity,
        launcher: ActivityResultLauncher<String>,
    ) {
        StaffFcmRegistrar.ensureChannels(activity.applicationContext)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (isGranted(activity)) return
        if (!promptedThisProcess.compareAndSet(false, true)) return
        launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    /** 웹 「알림 설정」 등 — 사용자가 다시 요청할 때 */
    fun promptFromUserAction(
        activity: ComponentActivity,
        launcher: ActivityResultLauncher<String>,
    ) {
        StaffFcmRegistrar.ensureChannels(activity.applicationContext)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (isGranted(activity)) return
        launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
