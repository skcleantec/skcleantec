package com.cbiseo.depositalert.net

import com.cbiseo.depositalert.data.PendingDeposit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class DepositApi {
    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .build()
    private val json = "application/json; charset=utf-8".toMediaType()

    fun register(base: String, code: String, deviceName: String, appVersion: String): RegisterReply {
        val body = JSONObject()
            .put("code", code)
            .put("deviceName", deviceName)
            .put("appVersion", appVersion)
            .toString()
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
        val payload = try {
            ingestJson(items)
        } catch (_: Exception) {
            return IngestReply.Rejected
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

    fun heartbeat(base: String, token: String): HeartbeatResult {
        val request = Request.Builder()
            .url("${base.trimEnd('/')}/api/bank-deposits/heartbeat")
            .header("Authorization", "Bearer $token")
            .post("{}".toRequestBody(json))
            .build()
        return try {
            http.newCall(request).execute().use { response ->
                val text = response.body?.string().orEmpty()
                HeartbeatResult(response.code, response.code in 200..299 && Regex(""""rescan"\s*:\s*true"""").containsMatchIn(text))
            }
        } catch (_: Exception) {
            HeartbeatResult(0, false)
        }
    }

    fun scanReport(base: String, token: String, scanned: Int, found: Int): Int {
        val body = JSONObject().put("scanned", scanned).put("found", found).toString()
        val request = Request.Builder()
            .url("${base.trimEnd('/')}/api/bank-deposits/scan-report")
            .header("Authorization", "Bearer $token")
            .post(body.toRequestBody(json))
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
}

data class HeartbeatResult(val code: Int, val rescan: Boolean)

fun ingestJson(items: List<PendingDeposit>): String {
    val rows = JSONArray()
    for (row in items) {
        rows.put(
            JSONObject()
                .put("dedupeKey", row.dedupeKey)
                .put("sender", row.sender)
                .put("text", row.text)
                .put("receivedAt", row.receivedAt)
                .put("contentHash", row.contentHash)
                .put("source", row.source),
        )
    }
    return JSONObject().put("items", rows).toString()
}
