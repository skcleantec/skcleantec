package com.cbiseo.app.api

object ApiEnvironment {
    const val PRODUCTION_URL = "https://www.cbiseo.com"
    const val STAGING_URL = "https://clean-solution-staging.up.railway.app"

    private const val SERVER_CHOICE_LOGIN_ID = "pyo"

    enum class Preset(val url: String) {
        PRODUCTION(PRODUCTION_URL),
        STAGING(STAGING_URL),
    }

    fun canChooseServer(loginId: String?): Boolean =
        loginId?.trim()?.lowercase() == SERVER_CHOICE_LOGIN_ID

    fun resolveForUser(loginId: String?, storedUrl: String?, selectedUrl: String? = null): String {
        if (canChooseServer(loginId)) {
            normalize(selectedUrl)?.let { return it }
            normalize(storedUrl)?.let { return it }
        }
        return PRODUCTION_URL
    }

    fun normalize(raw: String?): String? {
        val trimmed = raw?.trim()?.trimEnd('/') ?: return null
        if (trimmed.isBlank()) return null
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return null
        return trimmed
    }

    fun presetForUrl(url: String?): Preset? =
        when (normalize(url)) {
            PRODUCTION_URL -> Preset.PRODUCTION
            STAGING_URL -> Preset.STAGING
            else -> null
        }
}
