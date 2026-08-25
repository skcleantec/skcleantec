package com.cbiseo.app.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.core.content.ContextCompat
import com.cbiseo.app.auth.TokenStore
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object StaffFcmRegistrar {
    const val CHANNEL_DEFAULT = "cbiseo_staff_default"
    private const val TAG = "StaffFcmRegistrar"
    private const val JWT_RETRY_MAX = 6
    private const val REGISTER_DEBOUNCE_MS = 15_000L
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastRegisterAtMs = 0L
    private var lastRegisteredKey: String? = null

    fun ensureChannels(context: android.content.Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_DEFAULT) != null) return
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

    /** 로그인·설정 화면에서 강제 재등록 (debounce 무시) */
    fun registerTokenForce(
        context: android.content.Context,
        jwtOverride: String? = null,
        onResult: ((Boolean, String) -> Unit)? = null,
    ) {
        registerTokenInternal(
            context.applicationContext,
            knownFcmToken = null,
            jwtAttempt = 0,
            force = true,
            jwtOverride = jwtOverride,
            onResult = onResult,
        )
    }

    /** FCM 토큰 → POST /api/push/staff-app/register (로그인 JWT 필요) */
    fun registerToken(
        context: android.content.Context,
        knownFcmToken: String? = null,
        jwtOverride: String? = null,
        onResult: ((Boolean, String) -> Unit)? = null,
    ) {
        registerTokenInternal(
            context.applicationContext,
            knownFcmToken,
            jwtAttempt = 0,
            force = knownFcmToken != null,
            jwtOverride = jwtOverride,
            onResult = onResult,
        )
    }

    /** 로그아웃 시 서버 FCM 토큰 삭제 — JWT clear 전에 호출 */
    fun unregisterToken(context: android.content.Context) {
        val jwt = TokenStore.get(context).getToken()?.trim().orEmpty()
        if (jwt.isBlank()) return
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            val token = task.result?.trim()?.takeIf { it.length >= 20 }
            CoroutineScope(Dispatchers.Main).launch {
                StaffPushApi.unregisterToken(context, token)
            }
        }
    }

    private fun registerTokenInternal(
        context: android.content.Context,
        knownFcmToken: String?,
        jwtAttempt: Int,
        force: Boolean,
        jwtOverride: String? = null,
        onResult: ((Boolean, String) -> Unit)? = null,
    ) {
        val jwt = jwtOverride?.trim()?.takeIf { it.isNotBlank() }
            ?: TokenStore.get(context).getToken()?.trim().orEmpty()
        if (jwt.isBlank()) {
            if (jwtAttempt < JWT_RETRY_MAX) {
                val delayMs = 250L * (jwtAttempt + 1)
                Log.d(TAG, "JWT not ready, retry FCM register in ${delayMs}ms (attempt ${jwtAttempt + 1})")
                mainHandler.postDelayed({
                    registerTokenInternal(context, knownFcmToken, jwtAttempt + 1, force, jwtOverride, onResult)
                }, delayMs)
            } else {
                val msg = "로그인 JWT 없음 — 앱에서 다시 로그인해 주세요"
                Log.w(TAG, "FCM register skipped: no JWT after $JWT_RETRY_MAX retries")
                onResult?.invoke(false, msg)
            }
            return
        }

        val registerWithToken: (String) -> Unit = register@{ fcmToken ->
            if (fcmToken.length < 20) {
                val msg = "FCM 토큰을 받지 못했습니다. Google Play 서비스·앱 재설치를 확인해 주세요"
                Log.w(TAG, "FCM token empty or too short")
                onResult?.invoke(false, msg)
                return@register
            }
            val key = "${jwt.take(12)}:${fcmToken.take(24)}"
            val now = System.currentTimeMillis()
            if (!force && key == lastRegisteredKey && now - lastRegisterAtMs < REGISTER_DEBOUNCE_MS) {
                onResult?.invoke(true, "이미 등록됨")
                return@register
            }
            Log.i(TAG, "FCM token ready (${fcmToken.length} chars), registering with server…")
            CoroutineScope(Dispatchers.Main).launch {
                val result = StaffPushApi.registerToken(context, fcmToken, jwtOverride = jwt)
                if (result.isSuccess) {
                    lastRegisteredKey = key
                    lastRegisterAtMs = System.currentTimeMillis()
                    onResult?.invoke(true, "서버 등록 완료")
                } else {
                    val msg = result.exceptionOrNull()?.message ?: "서버 등록 실패"
                    if (jwtAttempt < JWT_RETRY_MAX) {
                        mainHandler.postDelayed({
                            registerTokenInternal(context, knownFcmToken, jwtAttempt + 1, force = true, jwtOverride, onResult)
                        }, 500L)
                    } else {
                        onResult?.invoke(false, msg)
                    }
                }
            }
        }

        val trimmedKnown = knownFcmToken?.trim().orEmpty()
        if (trimmedKnown.length >= 20) {
            registerWithToken(trimmedKnown)
            return
        }

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                val msg = task.exception?.message?.takeIf { it.isNotBlank() }
                    ?: "FCM 토큰 발급 실패 — Firebase SHA·google-services.json 확인"
                Log.w(TAG, "FCM token fetch failed", task.exception)
                onResult?.invoke(false, msg)
                return@addOnCompleteListener
            }
            registerWithToken(task.result?.trim().orEmpty())
        }
    }
}
