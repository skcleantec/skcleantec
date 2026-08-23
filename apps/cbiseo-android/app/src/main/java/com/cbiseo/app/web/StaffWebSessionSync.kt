package com.cbiseo.app.web

import android.webkit.WebView
import com.cbiseo.app.auth.JwtPayload

/** WebView `/login` 성공 후 localStorage JWT → 네이티브 TokenStore 동기화 */
object StaffWebSessionSync {
    data class CapturedSession(
        val token: String,
        val role: String?,
        val tenantSlug: String?,
    )

    fun captureFromWebView(webView: WebView, onResult: (CapturedSession?) -> Unit) {
        webView.evaluateJavascript(CAPTURE_SCRIPT) { raw ->
            val token = decodeJsString(raw)?.takeIf { it.isNotBlank() }
            if (token.isNullOrBlank()) {
                onResult(null)
                return@evaluateJavascript
            }
            val role = JwtPayload.roleFromToken(token)
            webView.evaluateJavascript(TENANT_SLUG_SCRIPT) { slugRaw ->
                val tenantSlug = decodeJsString(slugRaw)?.takeIf { it.isNotBlank() }
                onResult(CapturedSession(token = token, role = role, tenantSlug = tenantSlug))
            }
        }
    }

    fun isStaffAppHomeUrl(url: String, apiBaseUrl: String): Boolean {
        if (!url.startsWith(apiBaseUrl)) return false
        val path = url.removePrefix(apiBaseUrl).substringBefore('?').substringBefore('#')
        return path.startsWith("/team/") || path.startsWith("/admin/")
    }

    fun isStaffWebLoginUrl(url: String, apiBaseUrl: String): Boolean {
        if (!url.startsWith(apiBaseUrl)) return false
        val path = url.removePrefix(apiBaseUrl).substringBefore('?').substringBefore('#')
        return path == "/login" || path.startsWith("/login/")
    }

    private fun decodeJsString(raw: String?): String? {
        if (raw.isNullOrBlank() || raw == "null") return null
        return raw.trim().removeSurrounding("\"").replace("\\\"", "\"")
    }

    private const val CAPTURE_SCRIPT = """
        (function(){
          try {
            var admin = localStorage.getItem('sk_admin_token') || '';
            var team = localStorage.getItem('sk_team_token') || '';
            return admin || team || '';
          } catch (e) { return ''; }
        })();
    """.trimIndent()

    private const val TENANT_SLUG_SCRIPT = """
        (function(){
          try { return localStorage.getItem('sk_tenant_slug') || ''; }
          catch (e) { return ''; }
        })();
    """.trimIndent()
}
