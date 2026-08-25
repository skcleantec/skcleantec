package com.cbiseo.app.push

import android.content.Context
import android.util.Log
import com.cbiseo.app.auth.TokenStore
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

/**
 * Firebase FCM 권장 흐름 (2025):
 * 1) onNewToken 캐시 + 서버 등록
 * 2) 앱 기동 시 토큰 prefetch
 * 3) 로그인·설정에서 JWT(TokenStore, WebView sync) + 캐시/await 토큰으로 POST
 */
object StaffPushRegistration {
    private const val TAG = "StaffPushRegistration"
    private const val FCM_TIMEOUT_MS = 25_000L
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    fun prefetchToken(context: Context) {
        scope.launch(Dispatchers.IO) {
            runCatching {
                val token = withTimeout(FCM_TIMEOUT_MS) {
                    FirebaseMessaging.getInstance().token.await().trim()
                }
                if (token.length >= 20) {
                    StaffPushTokenCache.save(context, token)
                    Log.i(TAG, "FCM prefetch ok (${token.length} chars)")
                }
            }.onFailure { e ->
                Log.w(TAG, "FCM prefetch skipped: ${e.message}")
            }
        }
    }

    fun onNewToken(context: Context, token: String) {
        val trimmed = token.trim()
        if (trimmed.length < 20) return
        StaffPushTokenCache.save(context, trimmed)
        registerNow(context, source = "onNewToken", jwtOverride = null, knownFcmToken = trimmed)
    }

    fun registerNow(
        context: Context,
        source: String,
        jwtOverride: String? = null,
        knownFcmToken: String? = null,
        onFinished: ((Boolean, String) -> Unit)? = null,
    ) {
        StaffPushRegistrationStatus.setPending()
        scope.launch {
            val result = runInternal(context.applicationContext, jwtOverride, knownFcmToken, source)
            if (result.ok) {
                StaffPushRegistrationStatus.setSuccess(result.message, result.fcmToken)
            } else {
                StaffPushRegistrationStatus.setFailure(result.message, result.fcmToken)
            }
            onFinished?.invoke(result.ok, result.message)
        }
    }

    private data class InternalResult(val ok: Boolean, val message: String, val fcmToken: String?)

    private suspend fun runInternal(
        context: Context,
        jwtOverride: String?,
        knownFcmToken: String?,
        source: String,
    ): InternalResult = withContext(Dispatchers.IO) {
        val gps = GoogleApiAvailability.getInstance()
        val gpsCode = gps.isGooglePlayServicesAvailable(context)
        if (gpsCode != ConnectionResult.SUCCESS) {
            val msg = gps.getErrorString(gpsCode)?.takeIf { it.isNotBlank() }
                ?: "Google Play 서비스 필요 (코드 $gpsCode)"
            Log.w(TAG, "GPS unavailable: $msg source=$source")
            return@withContext InternalResult(false, msg, null)
        }

        val jwt = jwtOverride?.trim()?.takeIf { it.isNotBlank() }
            ?: TokenStore.get(context).getToken()?.trim().orEmpty()
        if (jwt.isBlank()) {
            return@withContext InternalResult(false, "로그인 JWT 없음 — 다시 로그인해 주세요", null)
        }

        val fcmResult = resolveFcmToken(context, knownFcmToken)
        val fcmToken = fcmResult.getOrElse { e ->
            val msg = e.message?.takeIf { it.isNotBlank() } ?: "FCM 토큰 발급 실패"
            Log.w(TAG, "FCM resolve failed source=$source: $msg")
            return@withContext InternalResult(false, msg, null)
        }

        val apiResult = StaffPushApi.registerToken(context, fcmToken, jwtOverride = jwt)
        if (apiResult.isSuccess) {
            Log.i(TAG, "Server register ok source=$source")
            InternalResult(true, "서버 등록 완료", fcmToken)
        } else {
            val msg = apiResult.exceptionOrNull()?.message ?: "서버 등록 실패"
            Log.w(TAG, "Server register failed source=$source: $msg")
            InternalResult(false, msg, fcmToken)
        }
    }

    private suspend fun resolveFcmToken(context: Context, knownFcmToken: String?): Result<String> {
        val known = knownFcmToken?.trim().orEmpty()
        if (known.length >= 20) return Result.success(known)

        StaffPushTokenCache.get(context)?.let { cached ->
            return Result.success(cached)
        }

        return runCatching {
            withTimeout(FCM_TIMEOUT_MS) {
                FirebaseMessaging.getInstance().token.await().trim()
            }
        }.mapCatching { token ->
            if (token.length < 20) throw IllegalStateException("FCM 토큰이 비어 있습니다")
            StaffPushTokenCache.save(context, token)
            token
        }.recoverCatching {
            Log.w(TAG, "getToken failed, retry after deleteToken: ${it.message}")
            FirebaseMessaging.getInstance().deleteToken().await()
            withTimeout(FCM_TIMEOUT_MS) {
                FirebaseMessaging.getInstance().token.await().trim()
            }.also { refreshed ->
                if (refreshed.length < 20) throw IllegalStateException("FCM 토큰 재발급 실패")
                StaffPushTokenCache.save(context, refreshed)
            }
        }
    }
}
