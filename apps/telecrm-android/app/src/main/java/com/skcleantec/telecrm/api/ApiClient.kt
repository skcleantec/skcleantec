package com.skcleantec.telecrm.api

import com.skcleantec.telecrm.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class LoginResult(
    val token: String,
    val userName: String?,
)

class ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    fun login(tenantSlug: String, loginId: String, password: String): Result<LoginResult> {
        return runCatching {
            val body = JSONObject()
                .put("tenantSlug", tenantSlug.trim())
                .put("email", loginId.trim().lowercase())
                .put("password", password)
                .toString()
                .toRequestBody(jsonMedia)

            val request = Request.Builder()
                .url("${BuildConfig.API_BASE_URL}/api/auth/login")
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val err = runCatching { JSONObject(raw).optString("error") }.getOrNull()
                    throw IllegalStateException(err?.takeIf { it.isNotBlank() } ?: "로그인에 실패했습니다.")
                }
                val json = JSONObject(raw)
                val token = json.getString("token")
                val userName = json.optJSONObject("user")?.optString("name")
                LoginResult(token = token, userName = userName)
            }
        }
    }

    fun getMobileConfig(token: String): Result<JSONObject> {
        return authorizedGet("/api/crm/mobile-config", token)
    }

    fun postCallSession(token: String, payload: JSONObject): Result<Unit> {
        return runCatching {
            val body = payload.toString().toRequestBody(jsonMedia)
            val request = Request.Builder()
                .url("${BuildConfig.API_BASE_URL}/api/crm/call-sessions")
                .addHeader("Authorization", "Bearer $token")
                .post(body)
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val raw = response.body?.string().orEmpty()
                    val err = runCatching { JSONObject(raw).optString("error") }.getOrNull()
                    throw IllegalStateException(err ?: "통화 기록 저장 실패")
                }
            }
        }
    }

    private fun authorizedGet(path: String, token: String): Result<JSONObject> {
        return runCatching {
            val request = Request.Builder()
                .url("${BuildConfig.API_BASE_URL}$path")
                .addHeader("Authorization", "Bearer $token")
                .get()
                .build()
            client.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException("API 오류 (${response.code})")
                }
                JSONObject(raw)
            }
        }
    }
}
