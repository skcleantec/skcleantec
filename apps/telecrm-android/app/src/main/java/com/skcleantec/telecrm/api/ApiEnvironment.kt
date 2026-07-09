package com.skcleantec.telecrm.api

/** PC CRM과 동일한 Railway 호스트 — pyo만 스테이징 선택, 그 외는 운영 고정 */
object ApiEnvironment {
    const val PRODUCTION_URL = "https://www.cbiseo.com"
    const val STAGING_URL = "https://clean-solution-staging.up.railway.app"

    /** 스테이징·운영 선택 UI — 이 아이디만 허용 */
    private const val SERVER_CHOICE_LOGIN_ID = "pyo"

    enum class Preset(val url: String, val label: String) {
        PRODUCTION(PRODUCTION_URL, "운영"),
        STAGING(STAGING_URL, "스테이징"),
    }

    fun canChooseServer(loginId: String?): Boolean =
        loginId?.trim()?.lowercase() == SERVER_CHOICE_LOGIN_ID

    /** pyo만 저장값·선택값 반영, 그 외는 항상 운영(cbiseo.com) */
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

    fun presetForUrl(url: String?): Preset? {
        val normalized = normalize(url) ?: return null
        return when (normalized) {
            PRODUCTION_URL -> Preset.PRODUCTION
            STAGING_URL -> Preset.STAGING
            else -> null
        }
    }

    /** @deprecated resolveForUser(loginId, storedUrl) 사용 */
    fun resolve(storedUrl: String?): String = resolveForUser(null, storedUrl)
}
