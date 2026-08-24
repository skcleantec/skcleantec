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

    data class LoginFormDraft(
        val tenantSlug: String,
        val loginId: String,
        val password: String,
    )

    fun readLoginFormDraft(webView: WebView, onResult: (LoginFormDraft?) -> Unit) {
        webView.evaluateJavascript(READ_LOGIN_FORM_SCRIPT) { raw ->
            onResult(parseLoginFormDraft(raw))
        }
    }

    fun injectLoginFormDraft(webView: WebView, draft: LoginFormDraft?) {
        if (draft == null) return
        val json = org.json.JSONObject()
            .put("tenant", draft.tenantSlug)
            .put("loginId", draft.loginId)
            .put("password", draft.password)
            .toString()
            .replace("\\", "\\\\")
            .replace("'", "\\'")
        webView.evaluateJavascript(
            "(function(){try{var d=JSON.parse('$json');" +
                "var t=document.getElementById('login-tenant');" +
                "var i=document.getElementById('login-id');" +
                "var p=document.getElementById('login-password');" +
                "if(t&&d.tenant){t.value=d.tenant;t.dispatchEvent(new Event('input',{bubbles:true}));}" +
                "if(i&&d.loginId){i.value=d.loginId;i.dispatchEvent(new Event('input',{bubbles:true}));}" +
                "if(p&&d.password){p.value=d.password;p.dispatchEvent(new Event('input',{bubbles:true}));}" +
                "}catch(e){}})();",
            null,
        )
    }

    private fun parseLoginFormDraft(raw: String?): LoginFormDraft? {
        val candidates = listOfNotNull(
            decodeJsString(raw)?.trim(),
            raw?.trim()?.removeSurrounding("\""),
        ).distinct()
        for (candidate in candidates) {
            if (candidate.isBlank() || !candidate.startsWith("{")) continue
            val parsed = runCatching {
                val o = org.json.JSONObject(candidate)
                LoginFormDraft(
                    tenantSlug = o.optString("tenant", "").trim(),
                    loginId = o.optString("loginId", "").trim(),
                    password = o.optString("password", ""),
                )
            }.getOrNull()
            if (parsed != null && (parsed.loginId.isNotBlank() || parsed.tenantSlug.isNotBlank())) {
                return parsed
            }
        }
        return null
    }

    fun readLoginIdFromWebView(webView: WebView, onResult: (String?) -> Unit) {
        webView.evaluateJavascript(READ_LOGIN_ID_SCRIPT) { raw ->
            onResult(decodeJsString(raw)?.trim()?.lowercase()?.takeIf { it.isNotBlank() })
        }
    }

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

    private val CAPTURE_SCRIPT = """
        (function(){
          try {
            var admin = localStorage.getItem('sk_admin_token') || '';
            var team = localStorage.getItem('sk_team_token') || '';
            return admin || team || '';
          } catch (e) { return ''; }
        })();
    """.trimIndent()

    private val TENANT_SLUG_SCRIPT = """
        (function(){
          try { return localStorage.getItem('sk_tenant_slug') || ''; }
          catch (e) { return ''; }
        })();
    """.trimIndent()

    private val READ_LOGIN_ID_SCRIPT = """
        (function(){
          try {
            var el = document.getElementById('login-id');
            return el && el.value ? el.value : '';
          } catch (e) { return ''; }
        })();
    """.trimIndent()

    private val READ_LOGIN_FORM_SCRIPT = """
        (function(){
          try {
            var t = document.getElementById('login-tenant');
            var i = document.getElementById('login-id');
            var p = document.getElementById('login-password');
            return JSON.stringify({
              tenant: t && t.value ? t.value : '',
              loginId: i && i.value ? i.value : '',
              password: p && p.value ? p.value : ''
            });
          } catch (e) { return ''; }
        })();
    """.trimIndent()
}
