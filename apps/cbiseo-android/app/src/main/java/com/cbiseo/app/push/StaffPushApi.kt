package com.cbiseo.app.push

import android.content.Context
import android.util.Log
import com.cbiseo.app.api.ApiEnvironment
import com.cbiseo.app.auth.TokenStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object StaffPushApi {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    suspend fun registerToken(
        context: Context,
        fcmToken: String,
        jwtOverride: String? = null,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            postRegister(context, fcmToken, jwtOverride)
            Log.i(TAG, "FCM token registered with server")
        }.onFailure { e ->
            Log.e(TAG, "FCM token registration failed: ${e.message}", e)
        }.map { }
    }

    suspend fun unregisterToken(context: Context, fcmToken: String? = null): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val store = TokenStore.get(context.applicationContext)
            val jwt = store.getToken()?.trim().orEmpty()
            val baseUrl = ApiEnvironment.normalize(store.getApiBaseUrl()) ?: ApiEnvironment.PRODUCTION_URL
            if (jwt.isBlank()) {
                Log.w(TAG, "FCM unregister skipped: no JWT")
                return@runCatching
            }

            val body = JSONObject()
            if (!fcmToken.isNullOrBlank()) {
                body.put("token", fcmToken.trim())
            }
            val requestBody = body.toString().toRequestBody(jsonMedia)

            val request = Request.Builder()
                .url("$baseUrl/api/push/staff-app/register")
                .header("Authorization", "Bearer $jwt")
                .delete(requestBody)
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful && response.code != 404) {
                    val raw = response.body?.string().orEmpty()
                    val err = runCatching { JSONObject(raw).optString("error") }.getOrNull()
                    throw IllegalStateException(err?.takeIf { it.isNotBlank() } ?: "알림 해제 실패 (${response.code})")
                }
            }
            Log.i(TAG, "FCM token unregistered from server")
        }.onFailure { e ->
            Log.w(TAG, "FCM token unregister failed: ${e.message}")
        }.map { }
    }

    private fun postRegister(context: Context, fcmToken: String, jwtOverride: String? = null) {
        val store = TokenStore.get(context.applicationContext)
        val jwt = jwtOverride?.trim()?.takeIf { it.isNotBlank() }
            ?: store.getToken()?.trim().orEmpty()
        val baseUrl = ApiEnvironment.normalize(store.getApiBaseUrl()) ?: ApiEnvironment.PRODUCTION_URL
        if (jwt.isBlank()) {
            throw IllegalStateException("로그인 JWT 없음 — FCM 등록 보류")
        }

        val body = JSONObject()
            .put("token", fcmToken)
            .put("appId", "com.cbiseo.app")
            .put("deviceLabel", android.os.Build.MODEL)
            .toString()
            .toRequestBody(jsonMedia)

        val request = Request.Builder()
            .url("$baseUrl/api/push/staff-app/register")
            .header("Authorization", "Bearer $jwt")
            .post(body)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                val raw = response.body?.string().orEmpty()
                val err = runCatching { JSONObject(raw).optString("error") }.getOrNull()
                throw IllegalStateException(err?.takeIf { it.isNotBlank() } ?: "알림 등록 실패 (${response.code})")
            }
        }
        Log.i(TAG, "FCM token registered with server (base=$baseUrl)")
    }

    private const val TAG = "StaffPushApi"
}
