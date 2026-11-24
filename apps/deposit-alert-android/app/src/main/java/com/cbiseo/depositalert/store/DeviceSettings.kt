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
    }
}
