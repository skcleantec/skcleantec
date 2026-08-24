package com.cbiseo.app.web

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.Lifecycle
import com.cbiseo.app.api.ApiEnvironment
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
    private var staffSessionActive = false
    private var pendingStaffPushRegistration = false
    private var permissionLaunchInFlight = false
    private var permissionDialogCompleted = false
    private var notificationSettingsPromptShown = false
    private var openingLoginScreen = false
    private var pendingPushPath: String? = null
    private var systemBarsBottomPx = 0
    private lateinit var appBridge: CbiseoAppBridge

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { _ ->
        permissionLaunchInFlight = false
        permissionDialogCompleted = true
        StaffFcmRegistrar.registerToken(this)
        maybePromptOpenNotificationSettings()
    }

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
        val apiBaseUrl = resolveApiBaseUrl()
        val role = tokenStore.getRole()
        val homePath = StaffRoleResolver.homePathForRole(role)

        if (token.isNullOrBlank() || homePath == null) {
            openLoginScreen(clearSession = false)
            return
        }

        staffSessionActive = true
        StaffFcmRegistrar.ensureChannels(applicationContext)

        appBridge = CbiseoAppBridge(
            onRequestGoogleLogin = {},
            onRequestNotificationPermission = { ensureStaffPushRegistration() },
        )

        val webView = binding.staffWebView
        activeWebView = webView
        CookieManager.getInstance().setAcceptCookie(true)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.addJavascriptInterface(appBridge, "CbiseoApp")

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

                if (!StaffWebSessionSync.urlMatchesApiBase(current, apiBaseUrl)) return

                if (StaffWebSessionSync.isStaffWebLoginUrl(current, apiBaseUrl)) {
                    openLoginScreen(clearSession = true)
                    return
                }

                syncSafeAreaToWebView()
                maybeRegisterStaffPushFromWeb(current, apiBaseUrl)
                flushPendingPushPath()
            }
        }

        webView.loadUrl("about:blank")
    }

    override fun onResume() {
        super.onResume()
        webViewInForeground = true
        if (staffSessionActive) {
            ensureStaffPushRegistration()
        }
    }

    override fun onPostResume() {
        super.onPostResume()
        if (staffSessionActive && pendingStaffPushRegistration) {
            ensureStaffPushRegistration()
        }
    }

    /** WebView /team·/admin 로드 시에도 한 번 더 시도 */
    private fun maybeRegisterStaffPushFromWeb(currentUrl: String, apiBaseUrl: String) {
        if (StaffWebSessionSync.isStaffWebLoginUrl(currentUrl, apiBaseUrl)) return
        if (!StaffWebSessionSync.isStaffAppHomeUrl(currentUrl, apiBaseUrl)) return
        ensureStaffPushRegistration()
    }

    /**
     * Firebase: FCM 토큰은 알림 권한과 무관 — 항상 서버 등록 후 권한 팝업.
     */
    private fun ensureStaffPushRegistration() {
        if (!staffSessionActive || isFinishing || isDestroyed) return
        if (!lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
            pendingStaffPushRegistration = true
            return
        }
        pendingStaffPushRegistration = false

        StaffFcmRegistrar.registerToken(this)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
            if (granted) return
            if (permissionLaunchInFlight || permissionDialogCompleted) {
                maybePromptOpenNotificationSettings()
                return
            }
            permissionLaunchInFlight = true
            window.decorView.post {
                if (isFinishing || isDestroyed) {
                    permissionLaunchInFlight = false
                    return@post
                }
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    /** 「다시 묻지 않음」 등으로 팝업이 더 이상 안 뜰 때 설정 화면 안내 */
    private fun maybePromptOpenNotificationSettings() {
        if (notificationSettingsPromptShown || isFinishing || isDestroyed) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) return
        if (!permissionDialogCompleted) return
        if (ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.POST_NOTIFICATIONS)) {
            return
        }
        notificationSettingsPromptShown = true
        AlertDialog.Builder(this)
            .setTitle(getString(com.cbiseo.app.R.string.notification_permission_title))
            .setMessage(getString(com.cbiseo.app.R.string.notification_permission_settings_message))
            .setPositiveButton(getString(com.cbiseo.app.R.string.open_settings)) { _, _ ->
                startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", packageName, null)
                    },
                )
            }
            .setNegativeButton(getString(com.cbiseo.app.R.string.later), null)
            .show()
    }

    private fun resolveApiBaseUrl(): String =
        ApiEnvironment.normalize(tokenStore.getApiBaseUrl()) ?: ApiEnvironment.PRODUCTION_URL

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
        staffSessionActive = false
        if (clearSession) tokenStore.clearSession()
        startActivity(
            Intent(this, LoginActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
        )
        finish()
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
