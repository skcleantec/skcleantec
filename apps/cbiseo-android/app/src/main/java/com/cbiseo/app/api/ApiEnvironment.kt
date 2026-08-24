package com.cbiseo.app.api

object ApiEnvironment {
    const val PRODUCTION_URL = "https://www.cbiseo.com"
    const val STAGING_URL = "https://clean-solution-staging.up.railway.app"

    /** 스테이징·운영 선택 — 내부 푸시·FCM 테스트 계정만 */
    private val SERVER_CHOICE_LOGIN_IDS = setOf("pyo", "pyo2")

    enum class Preset(val url: String) {
        PRODUCTION(PRODUCTION_URL),
        STAGING(STAGING_URL),
    }

    fun canChooseServer(loginId: String?): Boolean {
        val id = loginId?.trim()?.lowercase() ?: return false
        // pyo2 입력 중 "pyo"에서 먼저 뜨지 않도록 완성형만 허용
        return id == "pyo" || id == "pyo2"
    }

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
