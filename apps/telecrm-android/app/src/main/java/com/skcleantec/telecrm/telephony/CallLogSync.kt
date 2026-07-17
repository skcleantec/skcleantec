package com.skcleantec.telecrm.telephony

import android.content.Context
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import org.json.JSONObject
import java.time.Instant

/** CallLog 검증 동기화 — 90초 이상만 CONNECTED */
object CallLogSync {
    const val CONNECTED_MIN_SEC = 90

    data class PendingOutbound(
        val phone: String,
        val inquiryId: String?,
        val customerMatch: String?,
        val startedAtMs: Long,
    )

    private var pendingOutbound: PendingOutbound? = null
    private val syncedIds = mutableSetOf<String>()

    fun armOutbound(phone: String, inquiryId: String?, customerMatch: String?) {
        val digits = phone.filter { it.isDigit() }
        if (digits.length < 4) return
        pendingOutbound = PendingOutbound(
            phone = digits,
            inquiryId = inquiryId?.takeIf { it.isNotBlank() },
            customerMatch = customerMatch?.takeIf { it.isNotBlank() },
            startedAtMs = System.currentTimeMillis() - 5_000,
        )
    }

    fun syncAfterCall(context: Context) {
        val pending = pendingOutbound
        pendingOutbound = null
        val sinceMs = pending?.startedAtMs ?: (System.currentTimeMillis() - 15 * 60 * 1000)
        val row = CallLogReader.readLatestSince(context, sinceMs) ?: return
        syncRow(context, row, pending)
    }

    fun syncRecent(context: Context, hoursBack: Int = 12) {
        val sinceMs = System.currentTimeMillis() - hoursBack * 60L * 60L * 1000
        val rows = CallLogReader.readRecent(context, 40)
            .filter { it.dateMs >= sinceMs }
        for (row in rows) {
            syncRow(context, row, null)
        }
    }

    fun syncKnownRow(
        context: Context,
        row: CallLogRow,
        inquiryId: String?,
        customerMatch: String?,
    ) {
        syncRow(
            context,
            row,
            PendingOutbound(
                phone = row.number.filter { it.isDigit() },
                inquiryId = inquiryId?.takeIf { it.isNotBlank() },
                customerMatch = customerMatch?.takeIf { it.isNotBlank() },
                startedAtMs = row.dateMs,
            ),
        )
    }

    private fun syncRow(context: Context, row: CallLogRow, pending: PendingOutbound?) {
        val callLogId = row.id.toString()
        if (syncedIds.contains(callLogId)) return
        val token = TokenStore.get(context).getToken() ?: return
        val apiClient = ApiClient.fromContext(context)
        val phone = pending?.phone?.takeIf { it.isNotBlank() } ?: row.number.filter { it.isDigit() }
        if (phone.length < 4) return
        val startedAt = Instant.ofEpochMilli(row.dateMs).toString()
        val endedAt = Instant.ofEpochMilli(row.dateMs + row.durationSec * 1000L).toString()
        val payload = JSONObject()
            .put("phone", phone)
            .put("direction", row.direction)
            .put("androidCallLogId", callLogId)
            .put("startedAt", startedAt)
            .put("endedAt", endedAt)
            .put("durationSec", row.durationSec)
            .put("connectedMinSec", CONNECTED_MIN_SEC)
            .put("source", "CALLLOG_SYNC")
        pending?.inquiryId?.let { payload.put("inquiryId", it) }
        pending?.customerMatch?.let { payload.put("customerMatch", it) }
        apiClient.syncCallSession(token, payload).onSuccess {
            syncedIds.add(callLogId)
            if (syncedIds.size > 200) syncedIds.clear()
        }
    }
}
