package com.skcleantec.telecrm.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class TokenStore(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun saveSession(
        token: String,
        tenantSlug: String,
        loginId: String,
        userName: String?,
        userId: String?,
        apiBaseUrl: String,
    ) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_TENANT_SLUG, tenantSlug)
            .putString(KEY_LOGIN_ID, loginId)
            .putString(KEY_USER_NAME, userName)
            .putString(KEY_USER_ID, userId)
            .putString(KEY_API_BASE_URL, apiBaseUrl)
            .apply()
    }

    fun getApiBaseUrl(): String? = prefs.getString(KEY_API_BASE_URL, null)?.takeIf { it.isNotBlank() }

    fun saveApiBaseUrl(apiBaseUrl: String) {
        prefs.edit().putString(KEY_API_BASE_URL, apiBaseUrl).apply()
    }

    fun getTenantSlug(): String? = prefs.getString(KEY_TENANT_SLUG, null)

    fun getLoginId(): String? = prefs.getString(KEY_LOGIN_ID, null)

    fun getUserName(): String? = prefs.getString(KEY_USER_NAME, null)

    fun getUserId(): String? = prefs.getString(KEY_USER_ID, null)

    fun clearSession() {
        val apiBaseUrl = getApiBaseUrl()
        val tenantSlug = getTenantSlug()
        val loginId = getLoginId()
        prefs.edit().clear().apply()
        apiBaseUrl?.let { saveApiBaseUrl(it) }
        tenantSlug?.let { prefs.edit().putString(KEY_TENANT_SLUG, it).apply() }
        loginId?.let { prefs.edit().putString(KEY_LOGIN_ID, it).apply() }
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "telecrm_secure_session"
        private const val KEY_TOKEN = "jwt"
        private const val KEY_TENANT_SLUG = "tenant_slug"
        private const val KEY_LOGIN_ID = "login_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_API_BASE_URL = "api_base_url"
    }
}
