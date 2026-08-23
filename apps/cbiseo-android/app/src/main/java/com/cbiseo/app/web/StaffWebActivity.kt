package com.cbiseo.app.web

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.cbiseo.app.auth.LoginActivity
import com.cbiseo.app.auth.TokenStore
import com.cbiseo.app.bridge.CbiseoAppBridge
import com.cbiseo.app.databinding.ActivityStaffWebBinding
import com.cbiseo.app.push.StaffFcmRegistrar
import com.cbiseo.app.session.StaffRoleResolver

class StaffWebActivity : AppCompatActivity() {
    private lateinit var binding: ActivityStaffWebBinding
    private val tokenStore by lazy { TokenStore.get(this) }
    private var sessionBootstrapDone = false
    private var fcmRegistered = false
    private var openingLoginScreen = false

    companion object {
        @Volatile
        private var activeWebView: WebView? = null

        fun dispatchInboxRefreshToWebView() {
            activeWebView?.post {
                activeWebView?.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('cbiseo:inbox-refresh'));",
                    null,
                )
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityStaffWebBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val token = tokenStore.getToken()
        val apiBaseUrl = tokenStore.getApiBaseUrl()
        val role = tokenStore.getRole()
        val homePath = StaffRoleResolver.homePathForRole(role)

        if (token.isNullOrBlank() || apiBaseUrl.isNullOrBlank() || homePath == null) {
            openLoginScreen(clearSession = false)
            return
        }

        val webView = binding.staffWebView
        activeWebView = webView
        CookieManager.getInstance().setAcceptCookie(true)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.addJavascriptInterface(CbiseoAppBridge(), "CbiseoApp")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString().orEmpty()
                if (StaffWebSessionSync.isStaffWebLoginUrl(url, apiBaseUrl)) {
                    openLoginScreen(clearSession = true)
                    return true
                }
                if (url.startsWith("http://") || url.startsWith("https://")) return false
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                val current = url ?: return

                if (!sessionBootstrapDone) {
                    if (current == "about:blank") {
                        sessionBootstrapDone = true
                        injectWebSession(webView, token, role)
                        webView.loadUrl("$apiBaseUrl$homePath")
                    }
                    return
                }

                if (!current.startsWith(apiBaseUrl)) return

                if (StaffWebSessionSync.isStaffWebLoginUrl(current, apiBaseUrl)) {
                    openLoginScreen(clearSession = true)
                    return
                }

                if (!fcmRegistered && current.contains(homePath)) {
                    fcmRegistered = true
                    StaffFcmRegistrar.requestPermissionAndRegister(this@StaffWebActivity)
                }
            }
        }

        webView.loadUrl("about:blank")
    }

    private fun openLoginScreen(clearSession: Boolean) {
        if (openingLoginScreen || isFinishing) return
        openingLoginScreen = true
        if (clearSession) tokenStore.clearSession()
        startActivity(
            Intent(this, LoginActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
        )
        finish()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        StaffFcmRegistrar.onRequestPermissionsResult(this, requestCode)
    }

    override fun onDestroy() {
        if (activeWebView === binding.staffWebView) {
            activeWebView = null
        }
        super.onDestroy()
    }

    private fun injectWebSession(webView: WebView, token: String, role: String?) {
        val escaped = token.replace("\\", "\\\\").replace("'", "\\'")
        val script = buildString {
            append("try{")
            append("localStorage.setItem('cbiseo_staff_app','1');")
            if (StaffRoleResolver.usesTeamToken(role)) {
                append("localStorage.setItem('sk_team_token','$escaped');")
            }
            if (StaffRoleResolver.usesAdminToken(role)) {
                append("localStorage.setItem('sk_admin_token','$escaped');")
            }
            append("}catch(e){}")
        }
        webView.evaluateJavascript(script, null)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.staffWebView.canGoBack()) {
            binding.staffWebView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
