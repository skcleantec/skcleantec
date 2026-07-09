package com.skcleantec.telecrm.api

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import android.content.Context
import com.skcleantec.telecrm.auth.TokenStore

data class LoginResult(
    val token: String,
    val userName: String?,
    val userId: String?,
)

data class SmsTemplateDto(
    val id: String,
    val label: String,
    val body: String,
    val imageUrl: String?,
)

class ApiClient(private val baseUrl: String) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    companion object {
        fun fromContext(context: Context): ApiClient {
            val store = TokenStore(context.applicationContext)
            return ApiClient(ApiEnvironment.resolveForUser(store.getLoginId(), store.getApiBaseUrl()))
        }
    }

    fun login(tenantSlug: String, loginId: String, password: String): Result<LoginResult> {
        return runCatching {
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
                val userName = json.optJSONObject("user")?.optString("name")
                val userId = json.optJSONObject("user")?.optString("id")
                LoginResult(token = token, userName = userName, userId = userId)
            }
        }
    }

    fun customerLookup(token: String, phone: String?, name: String?): Result<JSONObject> {
        return runCatching {
            val parts = mutableListOf<String>()
            phone?.trim()?.takeIf { it.isNotEmpty() }?.let {
                parts.add("phone=${java.net.URLEncoder.encode(it, Charsets.UTF_8.name())}")
            }
            name?.trim()?.takeIf { it.isNotEmpty() }?.let {
                parts.add("name=${java.net.URLEncoder.encode(it, Charsets.UTF_8.name())}")
            }
            if (parts.isEmpty()) throw IllegalStateException("전화번호 또는 이름(2자 이상)을 입력해 주세요.")
            authorizedGet("/api/crm/customer-lookup?${parts.joinToString("&")}", token).getOrThrow()
        }
    }

    fun getCallSessionSummary(token: String, dayYmd: String): Result<JSONObject> {
        return authorizedGet("/api/crm/call-sessions/summary?day=$dayYmd", token)
    }

    fun getSmsTemplates(token: String): Result<List<SmsTemplateDto>> {
        return authorizedGet("/api/crm/sms-templates?scope=work", token).map { json ->
            val arr = json.optJSONArray("templates") ?: JSONArray()
            buildList {
                for (i in 0 until arr.length()) {
                    val row = arr.getJSONObject(i)
                    add(
                        SmsTemplateDto(
                            id = row.optString("id"),
                            label = row.optString("label"),
                            body = row.optString("body"),
                            imageUrl = row.optString("imageUrl").takeIf { it.isNotBlank() },
                        ),
                    )
                }
            }
        }
    }

    fun getOrderFormLink(token: String, inquiryId: String): Result<String> {
        return authorizedGet("/api/crm/order-form-link?inquiryId=${java.net.URLEncoder.encode(inquiryId, Charsets.UTF_8.name())}", token)
            .map { it.optString("url") }
    }

    fun getMobileConfig(token: String): Result<JSONObject> {
        return authorizedGet("/api/crm/mobile-config", token)
    }

    fun getAdminNavBadges(token: String): Result<JSONObject> =
        authorizedGet("/api/admin/nav-badges", token)

    fun fetchPendingMobileDispatches(token: String): Result<List<com.skcleantec.telecrm.dispatch.TelecrmDispatchPayload>> {
        return authorizedGet("/api/crm/mobile-dispatch/pending", token).map { json ->
            val items = json.optJSONArray("items") ?: JSONArray()
            buildList {
                for (i in 0 until items.length()) {
                    add(com.skcleantec.telecrm.dispatch.TelecrmDispatchPayload.fromJson(items.getJSONObject(i)))
                }
            }
        }
    }

    fun getUnreadMessageCount(token: String): Result<Int> =
        authorizedGet("/api/messages/unread-count", token).map { it.optInt("count", 0) }

    fun getConversations(token: String): Result<JSONArray> =
        authorizedGetArray("/api/messages/conversations", token)

    fun getMessages(token: String, userId: String): Result<JSONArray> =
        authorizedGetArray("/api/messages/$userId", token)

    fun sendMessage(token: String, receiverId: String, content: String): Result<Unit> {
        return runCatching {
            val body = JSONObject()
                .put("receiverId", receiverId)
                .put("content", content.trim())
                .toString()
                .toRequestBody(jsonMedia)
            val request = Request.Builder()
                .url("$baseUrl/api/messages")
                .addHeader("Authorization", "Bearer $token")
                .post(body)
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val raw = response.body?.string().orEmpty()
                    val err = runCatching { JSONObject(raw).optString("error") }.getOrNull()
                    throw IllegalStateException(err ?: "메시지 전송 실패")
                }
            }
        }
    }

    fun postCallSession(token: String, payload: JSONObject): Result<Unit> {
        return runCatching {
            val body = payload.toString().toRequestBody(jsonMedia)
            val request = Request.Builder()
                .url("$baseUrl/api/crm/call-sessions")
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

    private fun authorizedGetArray(path: String, token: String): Result<JSONArray> {
        return authorizedGetRaw(path, token).map { raw ->
            JSONArray(raw)
        }
    }

    private fun authorizedGet(path: String, token: String): Result<JSONObject> {
        return authorizedGetRaw(path, token).map { raw -> JSONObject(raw) }
    }

    private fun authorizedGetRaw(path: String, token: String): Result<String> {
        return runCatching {
            val request = Request.Builder()
                .url("$baseUrl$path")
                .addHeader("Authorization", "Bearer $token")
                .get()
                .build()
            client.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val err = runCatching { JSONObject(raw).optString("error") }.getOrNull()
                    throw IllegalStateException(err?.takeIf { it.isNotBlank() } ?: "API 오류 (${response.code})")
                }
                raw
            }
        }
    }
}
