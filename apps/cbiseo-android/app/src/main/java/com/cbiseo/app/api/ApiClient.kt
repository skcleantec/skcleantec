package com.cbiseo.app.api

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class LoginResult(
    val token: String,
    val userName: String?,
    val userId: String?,
    val role: String?,
)

class ApiClient(private val baseUrl: String) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    fun login(tenantSlug: String, loginId: String, password: String): Result<LoginResult> =
        runCatching {
            val body = JSONObject()
                .put("tenantSlug", tenantSlug.trim())
                .put("email", loginId.trim().lowercase())
                .put("password", password)
                .toString()
                .toRequestBody(jsonMedia)

            val request = Request.Builder()
                .url("$baseUrl/api/auth/login")
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
                val user = json.optJSONObject("user")
                LoginResult(
                    token = token,
                    userName = user?.optString("name"),
                    userId = user?.optString("id"),
                    role = user?.optString("role"),
                )
            }
        }

    fun fetchMe(token: String): Result<String?> =
        runCatching {
            val request = Request.Builder()
                .url("$baseUrl/api/auth/me")
                .header("Authorization", "Bearer $token")
                .get()
                .build()
            client.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) return@runCatching null
                JSONObject(raw).optJSONObject("user")?.optString("role")?.takeIf { it.isNotBlank() }
            }
        }
}
