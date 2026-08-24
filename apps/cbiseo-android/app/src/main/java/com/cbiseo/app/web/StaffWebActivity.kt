package com.cbiseo.app.web

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
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
    private var fcmPermissionRequested = false
    private var openingLoginScreen = false
    private var pendingPushPath: String? = null
    private var systemBarsBottomPx = 0

    companion object {
        const val EXTRA_PUSH_PATH = "push_path"

        @Volatile
        private var activeWebView: WebView? = null

        @Volatile
        private var webViewInForeground = false

        fun isWebViewActive(): Boolean = activeWebView != null

        fun isWebViewInForeground(): Boolean = webViewInForeground && activeWebView != null

        fun dispatchInboxRefreshToWebView() {
            activeWebView?.post {
                activeWebView?.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('cbiseo:inbox-refresh'));",
                    null,
                )
            }
        }

        fun dispatchNavigateToWebView(path: String) {
            if (path.isBlank()) return
            val escaped = path.replace("\\", "\\\\").replace("'", "\\'")
            activeWebView?.post {
                activeWebView?.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('cbiseo:navigate',{detail:{path:'$escaped'}}));",
                    null,
                )
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        binding = ActivityStaffWebBinding.inflate(layoutInflater)
        setContentView(binding.root)
        applyWindowInsets()
        pendingPushPath = intent.getStringExtra(EXTRA_PUSH_PATH)

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
        webView.addJavascriptInterface(CbiseoAppBridge(onRequestGoogleLogin = {}), "CbiseoApp")

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

                syncSafeAreaToWebView()
                maybeRegisterStaffPush(current, apiBaseUrl)

                flushPendingPushPath()
            }
        }

        webView.loadUrl("about:blank")
    }

    override fun onResume() {
        super.onResume()
        webViewInForeground = true
        val apiBaseUrl = tokenStore.getApiBaseUrl()?.trim()?.trimEnd('/').orEmpty()
        val current = binding.staffWebView.url.orEmpty()
        if (sessionBootstrapDone && apiBaseUrl.isNotBlank() && current.startsWith(apiBaseUrl)) {
            maybeRegisterStaffPush(current, apiBaseUrl)
        }
    }

    /** 팀·관리 화면 진입 시 FCM 토큰 서버 등록(재시도 포함). */
    private fun maybeRegisterStaffPush(currentUrl: String, apiBaseUrl: String) {
        if (StaffWebSessionSync.isStaffWebLoginUrl(currentUrl, apiBaseUrl)) return
        val path = currentUrl.removePrefix(apiBaseUrl)
        if (!path.startsWith("/team/") && !path.startsWith("/admin/")) return
        if (!fcmPermissionRequested) {
            fcmPermissionRequested = true
            StaffFcmRegistrar.requestPermissionAndRegister(this)
        } else {
            StaffFcmRegistrar.registerToken(this)
        }
    }

    override fun onPause() {
        webViewInForeground = false
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val path = intent.getStringExtra(EXTRA_PUSH_PATH)
        if (path.isNullOrBlank()) return
        if (sessionBootstrapDone && activeWebView != null) {
            dispatchNavigateToWebView(path)
        } else {
            pendingPushPath = path
        }
    }

    private fun flushPendingPushPath() {
        val path = pendingPushPath ?: return
        pendingPushPath = null
        dispatchInboxRefreshToWebView()
        dispatchNavigateToWebView(path)
    }

    private fun applyWindowInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            systemBarsBottomPx = bars.bottom
            syncSafeAreaToWebView()
            insets
        }
        ViewCompat.requestApplyInsets(binding.root)
    }

    private fun syncSafeAreaToWebView() {
        injectSafeAreaCss(systemBarsBottomPx)
    }

    private fun injectSafeAreaCss(bottomPx: Int) {
        val density = resources.displayMetrics.density
        val bottomDp = if (density > 0f) bottomPx / density else 0f
        activeWebView?.post {
            activeWebView?.evaluateJavascript(
                "try{document.documentElement.classList.add('cbiseo-staff-app');document.documentElement.style.setProperty('--cbiseo-safe-area-bottom','${bottomDp}px');}catch(e){}",
                null,
            )
        }
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
            append("document.documentElement.classList.add('cbiseo-staff-app');")
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
