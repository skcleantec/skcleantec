package com.cbiseo.app.auth

import android.util.Base64
import org.json.JSONObject

object JwtPayload {
    fun roleFromToken(token: String?): String? = stringClaim(token, "role")

    fun emailFromToken(token: String?): String? = stringClaim(token, "email")

    private fun stringClaim(token: String?, key: String): String? {
        if (token.isNullOrBlank()) return null
        val parts = token.split(".")
        if (parts.size < 2) return null
        return runCatching {
            val decoded = Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
            JSONObject(String(decoded, Charsets.UTF_8)).optString(key).takeIf { it.isNotBlank() }
        }.getOrNull()
    }
}
