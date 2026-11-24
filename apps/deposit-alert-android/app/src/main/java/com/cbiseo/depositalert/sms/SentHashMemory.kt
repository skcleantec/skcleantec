package com.cbiseo.depositalert.sms

import android.content.Context

/** 보낸 입금의 contentHash 만 7일 보관한다. 본문은 넣지 않는다. */
class SentHashMemory(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun contains(hash: String): Boolean {
        synchronized(lock) {
            return load(System.currentTimeMillis()).containsKey(hash)
        }
    }

    fun snapshot(): Set<String> {
        synchronized(lock) {
            return load(System.currentTimeMillis()).keys
        }
    }

    fun remember(hash: String) {
        if (hash.length != 64) return
        synchronized(lock) {
            val now = System.currentTimeMillis()
            val kept = load(now).toMutableMap()
            kept.putIfAbsent(hash, now)
            save(kept)
        }
    }

    private fun load(now: Long): Map<String, Long> {
        val raw = prefs.getString(KEY, "").orEmpty()
        if (raw.isBlank()) return emptyMap()
        val out = LinkedHashMap<String, Long>()
        for (line in raw.lineSequence()) {
            val part = line.split(',')
            if (part.size != 2 || part[0].length != 64) continue
            val at = part[1].toLongOrNull() ?: continue
            if (now - at > KEEP_MS) continue
            out[part[0]] = at
        }
        return out
    }

    private fun save(rows: Map<String, Long>) {
        val text = rows.entries.sortedBy { it.value }.takeLast(400).joinToString("\n") { "${it.key},${it.value}" }
        prefs.edit().putString(KEY, text).commit()
    }

    companion object {
        private val lock = Any()
        private const val PREFS = "deposit_alert_sent_hash"
        private const val KEY = "hashes"
        private const val KEEP_MS = 7L * 24 * 60 * 60 * 1000
    }
}
