package com.cbiseo.depositalert.store

import android.content.Context
import com.cbiseo.depositalert.sms.NoticeRecord
import com.cbiseo.depositalert.sms.NoticeTally
import com.cbiseo.depositalert.sms.decodeNoticeRecord
import com.cbiseo.depositalert.sms.encodeNoticeRecord
import com.cbiseo.depositalert.sms.trimNoticeLog

/** 메시지 앱 알림을 받은 최근 20건. 이유와 개수만 두고 본문·이름·잔액·계좌는 넣지 않는다. */
class NoticeLog(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun add(record: NoticeRecord) {
        if (record.atMillis <= 0L) return
        synchronized(lock) {
            val rows = load().toMutableList()
            rows.add(record)
            save(trimNoticeLog(rows))
            addReasons(record)
        }
    }

    fun hiddenLostTotal(): Int = synchronized(lock) { prefs.getInt(KEY_HIDDEN_LOST, 0) }

    fun lastHiddenLostAt(): Long = synchronized(lock) { prefs.getLong(KEY_HIDDEN_AT, 0L) }

    fun recent(): List<NoticeRecord> = synchronized(lock) { load().asReversed() }

    fun reasonTotals(): NoticeTally = synchronized(lock) {
        val today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).toString()
        if (prefs.getString(KEY_DAY, "") != today) return NoticeTally()
        NoticeTally(
            sent = prefs.getInt(KEY_SENT, 0),
            alreadySent = prefs.getInt(KEY_DUP, 0),
            otherPath = prefs.getInt(KEY_OTHER, 0),
            withdrawal = prefs.getInt(KEY_WD, 0),
            noAmount = prefs.getInt(KEY_AMT, 0),
            notNh = prefs.getInt(KEY_NH, 0),
            noText = prefs.getInt(KEY_EMPTY, 0),
            balance = prefs.getInt(KEY_BAL, 0),
        )
    }

    private fun addReasons(record: NoticeRecord) {
        val tally = record.tally
        val today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).toString()
        val same = prefs.getString(KEY_DAY, "") == today
        val editor = prefs.edit().putString(KEY_DAY, today)
        fun put(key: String, add: Int) {
            val current = if (same) prefs.getInt(key, 0) else 0
            editor.putInt(key, current + add.coerceAtLeast(0))
        }
        put(KEY_SENT, tally.sent)
        put(KEY_DUP, tally.alreadySent)
        put(KEY_OTHER, tally.otherPath)
        put(KEY_WD, tally.withdrawal)
        put(KEY_AMT, tally.noAmount)
        put(KEY_NH, tally.notNh)
        put(KEY_EMPTY, tally.noText)
        put(KEY_BAL, tally.balance)
        if (tally.hiddenLost > 0) {
            editor.putInt(KEY_HIDDEN_LOST, prefs.getInt(KEY_HIDDEN_LOST, 0) + tally.hiddenLost)
            editor.putLong(KEY_HIDDEN_AT, record.atMillis)
        }
        editor.commit()
    }

    private fun load(): List<NoticeRecord> {
        val raw = prefs.getString(KEY, "").orEmpty()
        if (raw.isBlank()) return emptyList()
        val rows = ArrayList<NoticeRecord>()
        for (line in raw.lineSequence()) {
            val row = decodeNoticeRecord(line) ?: continue
            rows.add(row)
        }
        return rows
    }

    private fun save(rows: List<NoticeRecord>) {
        prefs.edit().putString(KEY, rows.joinToString("\n") { encodeNoticeRecord(it) }).commit()
    }

    companion object {
        private const val PREFS = "deposit_alert_plain"
        private const val KEY = "notice_log"
        private const val KEY_DAY = "reason_day"
        private const val KEY_SENT = "reason_sent"
        private const val KEY_DUP = "reason_dup"
        private const val KEY_OTHER = "reason_other"
        private const val KEY_WD = "reason_wd"
        private const val KEY_AMT = "reason_amt"
        private const val KEY_NH = "reason_nh"
        private const val KEY_EMPTY = "reason_empty"
        private const val KEY_BAL = "reason_bal"
        private const val KEY_HIDDEN_LOST = "hidden_lost_total"
        private const val KEY_HIDDEN_AT = "hidden_lost_at"
        private val lock = Any()
    }
}
