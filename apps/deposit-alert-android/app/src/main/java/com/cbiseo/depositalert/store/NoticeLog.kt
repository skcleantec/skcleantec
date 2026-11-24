package com.cbiseo.depositalert.store

import android.content.Context
import com.cbiseo.depositalert.sms.NoticeRecord
import com.cbiseo.depositalert.sms.NoticeRecordResult
import com.cbiseo.depositalert.sms.noticeResultCode
import com.cbiseo.depositalert.sms.noticeResultFromCode
import com.cbiseo.depositalert.sms.trimNoticeLog

/** 메시지 앱 알림을 받은 최근 20건. 시각·줄 수·결과만 두고 본문과 잔액은 넣지 않는다. */
class NoticeLog(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun add(atMillis: Long, lines: Int, result: NoticeRecordResult) {
        if (atMillis <= 0L || lines < 0) return
        synchronized(lock) {
            val rows = load().toMutableList()
            rows.add(NoticeRecord(atMillis, lines, result))
            save(trimNoticeLog(rows))
        }
    }

    fun recent(): List<NoticeRecord> = synchronized(lock) { load().asReversed() }

    private fun load(): List<NoticeRecord> {
        val raw = prefs.getString(KEY, "").orEmpty()
        if (raw.isBlank()) return emptyList()
        val rows = ArrayList<NoticeRecord>()
        for (line in raw.lineSequence()) {
            val part = line.split('|')
            if (part.size != 3) continue
            val at = part[0].toLongOrNull() ?: continue
            val count = part[1].toIntOrNull() ?: continue
            val result = noticeResultFromCode(part[2]) ?: continue
            if (at <= 0L || count < 0) continue
            rows.add(NoticeRecord(at, count, result))
        }
        return rows
    }

    private fun save(rows: List<NoticeRecord>) {
        val text = rows.joinToString("\n") { row ->
            "${row.atMillis}|${row.lines}|${noticeResultCode(row.result)}"
        }
        prefs.edit().putString(KEY, text).commit()
    }

    companion object {
        private const val PREFS = "deposit_alert_plain"
        private const val KEY = "notice_log"
        private val lock = Any()
    }
}
