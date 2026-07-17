package com.skcleantec.telecrm.telephony

import android.content.Context
import android.provider.CallLog
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class IncomingCallRow(
    val id: Long,
    val number: String,
    val dateMs: Long,
    val durationSec: Int,
)

data class CallLogRow(
    val id: Long,
    val number: String,
    val dateMs: Long,
    val durationSec: Int,
    val type: Int,
) {
    val direction: String
        get() = when (type) {
            CallLog.Calls.INCOMING_TYPE -> "INBOUND"
            CallLog.Calls.OUTGOING_TYPE -> "OUTBOUND"
            else -> "OUTBOUND"
        }
}

object CallLogReader {
    private fun rowFromCursor(it: android.database.Cursor): CallLogRow? {
        val number = it.getString(it.getColumnIndexOrThrow(CallLog.Calls.NUMBER))
            ?.filter { ch -> ch.isDigit() || ch == '+' }
            .orEmpty()
        if (number.length < 4) return null
        return CallLogRow(
            id = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls._ID)),
            number = number,
            dateMs = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DATE)),
            durationSec = it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.DURATION)),
            type = it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.TYPE)),
        )
    }

    fun readRecentIncoming(context: Context, limit: Int = 25): List<IncomingCallRow> {
        return readRecent(context, limit)
            .filter { it.type == CallLog.Calls.INCOMING_TYPE }
            .map { IncomingCallRow(it.id, it.number, it.dateMs, it.durationSec) }
    }

    fun readRecent(context: Context, limit: Int = 25): List<CallLogRow> {
        val rows = mutableListOf<CallLogRow>()
        val cursor = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE,
            ),
            null,
            null,
            "${CallLog.Calls.DATE} DESC",
        ) ?: return emptyList()
        cursor.use {
            var count = 0
            while (it.moveToNext() && count < limit) {
                rowFromCursor(it)?.let { row ->
                    rows.add(row)
                    count++
                }
            }
        }
        return rows
    }

    /** 통화 종료 직후 — sinceMs 이후 가장 최근 1건 */
    fun readLatestSince(context: Context, sinceMs: Long): CallLogRow? {
        val cursor = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE,
            ),
            "${CallLog.Calls.DATE} >= ?",
            arrayOf(sinceMs.toString()),
            "${CallLog.Calls.DATE} DESC",
        ) ?: return null
        cursor.use {
            if (!it.moveToFirst()) return null
            return rowFromCursor(it)
        }
    }

    fun formatWhen(dateMs: Long): String {
        val fmt = SimpleDateFormat("M/d HH:mm", Locale.KOREA)
        return fmt.format(Date(dateMs))
    }
}
