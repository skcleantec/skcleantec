package com.cbiseo.depositalert.sms

import android.content.Context

/** 본문은 저장하지 않고, 잔액을 지운 본문의 해시와 어느 경로로 봤는지만 남긴다. */
class ArrivalMemory(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun admit(rawText: String, receivedAtMillis: Long, source: IntakeSource): Boolean {
        val key = crossPathKey(rawText, receivedAtMillis)
        synchronized(lock) {
            val now = System.currentTimeMillis()
            val kept = load().filterValues { now - it.at < KEEP_MS }.toMutableMap()
            val current = kept[key]
            val (ok, next) = admitPath(current?.marks ?: PathMarks(), source)
            if (!ok) return false
            kept[key] = Stamp(next, current?.at ?: now)
            save(kept)
            return true
        }
    }

    private fun load(): Map<String, Stamp> {
        val raw = prefs.getString(KEY, "").orEmpty()
        if (raw.isBlank()) return emptyMap()
        val out = LinkedHashMap<String, Stamp>()
        for (line in raw.lineSequence()) {
            val part = line.split(',')
            if (part.size != 4 || part[0].length != 64) continue
            val at = part[3].toLongOrNull() ?: continue
            out[part[0]] = Stamp(PathMarks(part[1] == "1", part[2] == "1"), at)
        }
        return out
    }

    private fun save(rows: Map<String, Stamp>) {
        val trimmed = rows.entries.sortedBy { it.value.at }.takeLast(80)
        val text = trimmed.joinToString("\n") { (key, stamp) ->
            val sms = if (stamp.marks.sms) "1" else "0"
            val notice = if (stamp.marks.notice) "1" else "0"
            "$key,$sms,$notice,${stamp.at}"
        }
        prefs.edit().putString(KEY, text).commit()
    }

    private data class Stamp(val marks: PathMarks, val at: Long)

    companion object {
        private val lock = Any()
        private const val PREFS = "deposit_alert_seen"
        private const val KEY = "seen"
        private const val KEEP_MS = 2L * 60 * 60 * 1000
    }
}
