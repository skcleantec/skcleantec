package com.skcleantec.telecrm.auth

import android.util.Base64
import org.json.JSONObject

/** TokenStore에 userId가 없을 때(구버전 세션) JWT payload에서 userId 추출 */
object JwtUserId {
    fun fromToken(token: String?): String? {
        if (token.isNullOrBlank()) return null
        val parts = token.split(".")
        if (parts.size < 2) return null
        return runCatching {
            val decoded = Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
            JSONObject(String(decoded, Charsets.UTF_8)).optString("userId").takeIf { it.isNotBlank() }
        }.getOrNull()
    }
}
