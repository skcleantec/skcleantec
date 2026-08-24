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

    suspend fun registerToken(context: Context, fcmToken: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val store = TokenStore.get(context.applicationContext)
            val jwt = store.getToken()?.trim().orEmpty()
            val baseUrl = ApiEnvironment.normalize(store.getApiBaseUrl()) ?: ApiEnvironment.PRODUCTION_URL
            if (jwt.isBlank()) return@runCatching

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
            Log.i(TAG, "FCM token registered with server")
        }.onFailure { e ->
            Log.w(TAG, "FCM token registration failed", e)
        }
    }

    private const val TAG = "StaffPushApi"
}
