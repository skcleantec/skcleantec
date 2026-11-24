package com.cbiseo.depositalert.net

import com.cbiseo.depositalert.data.PendingDeposit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class DepositApi {
    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .build()
    private val json = "application/json; charset=utf-8".toMediaType()

    fun register(base: String, code: String, deviceName: String, appVersion: String): RegisterReply {
        val body = buildString {
            append("{\"code\":").append(quote(code))
            append(",\"deviceName\":").append(quote(deviceName))
            append(",\"appVersion\":").append(quote(appVersion)).append('}')
        }
        val request = Request.Builder()
            .url("${base.trimEnd('/')}/api/bank-deposits/devices/register")
            .post(body.toRequestBody(json))
            .build()
        return try {
            http.newCall(request).execute().use { response ->
                val text = response.body?.string().orEmpty()
                val token = Regex(""""token"\s*:\s*"([^"]+)"""").find(text)?.groupValues?.get(1)
                if (response.code in 200..299 && !token.isNullOrEmpty()) return RegisterReply.Ok(token)
                RegisterReply.Fail(safeError(text))
            }
        } catch (_: Exception) {
            RegisterReply.Fail("서버에 연결하지 못했어요.")
        }
    }

    fun ingest(base: String, token: String, items: List<PendingDeposit>): IngestReply {
        val payload = items.joinToString(prefix = "{\"items\":[", postfix = "]}") { row ->
            buildString {
                append("{\"dedupeKey\":").append(quote(row.dedupeKey))
                append(",\"sender\":").append(quote(row.sender))
                append(",\"text\":").append(quote(row.text))
                append(",\"receivedAt\":").append(quote(row.receivedAt)).append('}')
            }
        }
        val request = Request.Builder()
            .url("${base.trimEnd('/')}/api/bank-deposits/ingest")
            .header("Authorization", "Bearer $token")
            .post(payload.toRequestBody(json))
            .build()
        return try {
            http.newCall(request).execute().use { response ->
                val text = response.body?.string().orEmpty()
                interpretIngest(response.code, text, items.map { it.dedupeKey })
            }
        } catch (_: Exception) {
            IngestReply.Retry
        }
    }

    fun heartbeat(base: String, token: String): Int {
        val request = Request.Builder()
            .url("${base.trimEnd('/')}/api/bank-deposits/heartbeat")
            .header("Authorization", "Bearer $token")
            .post("{}".toRequestBody(json))
            .build()
        return try {
            http.newCall(request).execute().use { it.code }
        } catch (_: Exception) {
            0
        }
    }

    private fun safeError(body: String): String {
        val message = Regex(""""error"\s*:\s*"([^"]+)"""").find(body)?.groupValues?.get(1).orEmpty()
        if (message.isBlank() || message.length > 80 || message.contains("token", ignoreCase = true)) {
            return "연결하지 못했어요. 코드와 서버를 확인해 주세요."
        }
        return message
    }

    private fun quote(value: String): String {
        val escaped = value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
        return "\"$escaped\""
    }
}
