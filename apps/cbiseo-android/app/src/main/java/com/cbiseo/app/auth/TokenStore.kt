package com.cbiseo.app.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class TokenStore private constructor(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        context.applicationContext,
        PREFS_NAME,
        MasterKey.Builder(context.applicationContext).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }

    /** WebView localStorage JWT → FCM 등록 직전 동기화 */
    fun updateJwt(token: String) {
        val trimmed = token.trim()
        if (trimmed.isBlank()) return
        prefs.edit().putString(KEY_TOKEN, trimmed).commit()
    }

    fun saveSession(
        token: String,
        tenantSlug: String,
        loginId: String,
        userName: String?,
        userId: String?,
        role: String?,
        apiBaseUrl: String,
    ) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_TENANT_SLUG, tenantSlug)
            .putString(KEY_LOGIN_ID, loginId)
            .putString(KEY_USER_NAME, userName)
            .putString(KEY_USER_ID, userId)
            .putString(KEY_ROLE, role)
            .putString(KEY_API_BASE_URL, apiBaseUrl)
            .commit()
    }

    fun getApiBaseUrl(): String? = prefs.getString(KEY_API_BASE_URL, null)?.takeIf { it.isNotBlank() }

    fun getTenantSlug(): String? = prefs.getString(KEY_TENANT_SLUG, null)

    fun getLoginId(): String? = prefs.getString(KEY_LOGIN_ID, null)

    fun getRole(): String? = prefs.getString(KEY_ROLE, null)?.takeIf { it.isNotBlank() }
        ?: JwtPayload.roleFromToken(getToken())

    fun clearSession() {
        val apiBaseUrl = getApiBaseUrl()
        val tenantSlug = getTenantSlug()
        val loginId = getLoginId()
        prefs.edit().clear().apply()
        apiBaseUrl?.let { prefs.edit().putString(KEY_API_BASE_URL, it).apply() }
        tenantSlug?.let { prefs.edit().putString(KEY_TENANT_SLUG, it).apply() }
        loginId?.let { prefs.edit().putString(KEY_LOGIN_ID, it).apply() }
    }

    companion object {
        private const val PREFS_NAME = "cbiseo_staff_secure_session"
        private const val KEY_TOKEN = "jwt"
        private const val KEY_TENANT_SLUG = "tenant_slug"
        private const val KEY_LOGIN_ID = "login_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_ROLE = "role"
        private const val KEY_API_BASE_URL = "api_base_url"

        @Volatile
        private var instance: TokenStore? = null

        fun get(context: Context): TokenStore =
            instance ?: synchronized(this) {
                instance ?: TokenStore(context.applicationContext).also { instance = it }
            }
    }
}
