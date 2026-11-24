package com.cbiseo.depositalert.store

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** 서버 주소는 일반 설정, 기기 토큰은 암호화 저장. 토큰은 화면과 로그에 남기지 않는다. */

class DeviceSettings(context: Context) {
    private val app = context.applicationContext
    private val plain: SharedPreferences =
        app.getSharedPreferences("deposit_alert_plain", Context.MODE_PRIVATE)
    private val secret: SharedPreferences by lazy { openSecret() }

    fun serverBase(): String = plain.getString(KEY_SERVER, PRODUCTION) ?: PRODUCTION

    fun setServerBase(url: String) {
        plain.edit().putString(KEY_SERVER, url.trim().trimEnd('/')).apply()
    }

    fun listening(): Boolean = plain.getBoolean(KEY_LISTENING, false)

    fun setListening(on: Boolean) {
        plain.edit().putBoolean(KEY_LISTENING, on).apply()
    }

    fun lastSentAt(): Long = plain.getLong(KEY_LAST_SENT, 0L)

    fun markSent(at: Long) {
        plain.edit().putLong(KEY_LAST_SENT, at).apply()
    }

    fun needsReconnect(): Boolean = plain.getBoolean(KEY_RECONNECT, false)

    fun setNeedsReconnect(value: Boolean) {
        plain.edit().putBoolean(KEY_RECONNECT, value).apply()
    }

    fun hasToken(): Boolean = token().isNotEmpty()

    fun token(): String = secret.getString(KEY_TOKEN, "").orEmpty()

    fun saveToken(value: String) {
        secret.edit().putString(KEY_TOKEN, value).apply()
        setNeedsReconnect(false)
    }

    fun clearToken() {
        secret.edit().remove(KEY_TOKEN).apply()
        setNeedsReconnect(false)
        setListening(false)
    }

    fun messageNotice(): Boolean = plain.getBoolean(KEY_MESSAGE_NOTICE, false)

    fun setMessageNotice(on: Boolean) {
        plain.edit().putBoolean(KEY_MESSAGE_NOTICE, on).apply()
    }

    fun receivedCount(): Int = plain.getInt(KEY_RECEIVED, 0)

    fun depositCount(): Int = plain.getInt(KEY_DEPOSIT, 0)

    fun noteMessage(deposit: Boolean) {
        synchronized(lock) {
            val editor = plain.edit().putInt(KEY_RECEIVED, receivedCount() + 1)
            if (deposit) editor.putInt(KEY_DEPOSIT, depositCount() + 1)
            editor.commit()
        }
    }

    fun noteDrop(reason: com.cbiseo.depositalert.sms.DropReason, times: Int = 1) {
        if (times <= 0) return
        noteDrops(mapOf(reason to times))
    }

    fun noteDrops(counts: Map<com.cbiseo.depositalert.sms.DropReason, Int>) {
        if (counts.values.none { it > 0 }) return
        synchronized(lock) {
            val editor = plain.edit()
            for ((reason, count) in counts) {
                if (count <= 0) continue
                val key = dropKey(reason)
                editor.putInt(key, plain.getInt(key, 0) + count)
            }
            editor.commit()
        }
    }

    fun dropCount(reason: com.cbiseo.depositalert.sms.DropReason): Int = plain.getInt(dropKey(reason), 0)

    fun lateFoundToday(): Int {
        if (plain.getString(KEY_LATE_DAY, "") != todayKey()) return 0
        return plain.getInt(KEY_LATE_COUNT, 0)
    }

    fun noteLateFound(count: Int) {
        if (count <= 0) return
        synchronized(lock) {
            val today = todayKey()
            val current = if (plain.getString(KEY_LATE_DAY, "") == today) plain.getInt(KEY_LATE_COUNT, 0) else 0
            plain.edit().putString(KEY_LATE_DAY, today).putInt(KEY_LATE_COUNT, current + count).commit()
        }
    }

    fun lastScanAt(): Long = plain.getLong(KEY_SCAN_AT, 0L)

    fun lastScanFound(): Int = plain.getInt(KEY_SCAN_FOUND, 0)

    fun markScan(at: Long, found: Int) {
        plain.edit().putLong(KEY_SCAN_AT, at).putInt(KEY_SCAN_FOUND, found).commit()
    }

    fun listen(listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        plain.registerOnSharedPreferenceChangeListener(listener)
    }

    fun unlisten(listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        plain.unregisterOnSharedPreferenceChangeListener(listener)
    }

    private fun openSecret(): SharedPreferences {
        val master = MasterKey.Builder(app)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            app,
            "deposit_alert_secret",
            master,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    companion object {
        const val PRODUCTION = "https://www.cbiseo.com"
        const val STAGING = "https://clean-solution-staging.up.railway.app"
        private const val KEY_SERVER = "server_base"
        private const val KEY_LISTENING = "listening"
        private const val KEY_LAST_SENT = "last_sent_at"
        private const val KEY_RECONNECT = "needs_reconnect"
        private const val KEY_TOKEN = "device_token"
        private const val KEY_MESSAGE_NOTICE = "message_notice"
        private const val KEY_RECEIVED = "received_count"
        private const val KEY_DEPOSIT = "deposit_count"
        private const val KEY_LATE_DAY = "late_day"
        private const val KEY_LATE_COUNT = "late_count"
        private const val KEY_SCAN_AT = "scan_at"
        private const val KEY_SCAN_FOUND = "scan_found"
        private val lock = Any()

        private fun todayKey(): String {
            return java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).toString()
        }

        private fun dropKey(reason: com.cbiseo.depositalert.sms.DropReason): String = when (reason) {
            com.cbiseo.depositalert.sms.DropReason.NoBank -> "drop_no_bank"
            com.cbiseo.depositalert.sms.DropReason.NoDeposit -> "drop_no_deposit"
            com.cbiseo.depositalert.sms.DropReason.Blocked -> "drop_blocked"
            com.cbiseo.depositalert.sms.DropReason.BalanceLeft -> "drop_balance"
        }
    }
}
