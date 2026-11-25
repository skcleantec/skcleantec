package com.cbiseo.depositalert.store

import android.content.Context
import java.time.Instant
import java.time.ZoneId

/** 서비스가 다시 뜬 횟수와 마지막으로 꺼진 이유. 본문은 넣지 않는다. */
class ServiceHealth(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun noteStart(now: Long) = synchronized(lock) {
        val today = day(now)
        val count = if (prefs.getString(KEY_DAY, "") == today) prefs.getInt(KEY_RESTARTS, 0) else 0
        prefs.edit()
            .putString(KEY_DAY, today)
            .putInt(KEY_RESTARTS, count + 1)
            .commit()
    }

    fun noteTimeout(now: Long) = synchronized(lock) {
        prefs.edit()
            .putInt(KEY_TIMEOUTS, prefs.getInt(KEY_TIMEOUTS, 0) + 1)
            .putString(KEY_EXIT_REASON, "fgsTimeout")
            .putLong(KEY_EXIT_AT, now)
            .commit()
    }

    fun noteExit(reason: String, at: Long) {
        synchronized(lock) {
            if (reason.isBlank() || at <= 0L) return@synchronized
            if (at <= prefs.getLong(KEY_EXIT_AT, 0L)) return@synchronized
            prefs.edit().putString(KEY_EXIT_REASON, reason).putLong(KEY_EXIT_AT, at).commit()
        }
    }

    fun restartsToday(now: Long): Int = synchronized(lock) {
        if (prefs.getString(KEY_DAY, "") != day(now)) 0 else prefs.getInt(KEY_RESTARTS, 0)
    }

    fun timeoutCount(): Int = synchronized(lock) { prefs.getInt(KEY_TIMEOUTS, 0) }

    fun lastExitReason(): String = synchronized(lock) { prefs.getString(KEY_EXIT_REASON, "").orEmpty() }

    fun lastExitAt(): Long = synchronized(lock) { prefs.getLong(KEY_EXIT_AT, 0L) }

    private fun day(now: Long): String {
        return Instant.ofEpochMilli(now).atZone(ZoneId.of("Asia/Seoul")).toLocalDate().toString()
    }

    companion object {
        private const val PREFS = "deposit_alert_plain"
        private const val KEY_DAY = "health_day"
        private const val KEY_RESTARTS = "health_restarts"
        private const val KEY_TIMEOUTS = "health_timeouts"
        private const val KEY_EXIT_REASON = "health_exit_reason"
        private const val KEY_EXIT_AT = "health_exit_at"
        private val lock = Any()
    }
}
