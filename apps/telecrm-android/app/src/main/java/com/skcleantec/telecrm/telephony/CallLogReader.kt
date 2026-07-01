package com.skcleantec.telecrm.telephony

import android.content.Context
import android.provider.CallLog
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class IncomingCallRow(
    val number: String,
    val dateMs: Long,
    val durationSec: Int,
)

object CallLogReader {
    fun readRecentIncoming(context: Context, limit: Int = 25): List<IncomingCallRow> {
        val rows = mutableListOf<IncomingCallRow>()
        val cursor = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.DATE, CallLog.Calls.DURATION, CallLog.Calls.TYPE),
            "${CallLog.Calls.TYPE} = ?",
            arrayOf(CallLog.Calls.INCOMING_TYPE.toString()),
            "${CallLog.Calls.DATE} DESC",
        ) ?: return emptyList()
        cursor.use {
            var count = 0
            while (it.moveToNext() && count < limit) {
                val number = it.getString(0)?.filter { ch -> ch.isDigit() || ch == '+' }.orEmpty()
                if (number.length < 4) continue
                rows.add(
                    IncomingCallRow(
                        number = number,
                        dateMs = it.getLong(1),
                        durationSec = it.getInt(2),
                    ),
                )
                count++
            }
        }
        return rows
    }

    fun formatWhen(dateMs: Long): String {
        val fmt = SimpleDateFormat("M/d HH:mm", Locale.KOREA)
        return fmt.format(Date(dateMs))
    }
}
