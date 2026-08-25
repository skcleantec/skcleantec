package com.cbiseo.app.web

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.cbiseo.app.api.ApiEnvironment
import com.cbiseo.app.auth.LoginActivity
import com.cbiseo.app.auth.TokenStore
import com.cbiseo.app.bridge.CbiseoAppBridge
import com.cbiseo.app.databinding.ActivityStaffWebBinding
import com.cbiseo.app.push.StaffFcmRegistrar
import com.cbiseo.app.push.StaffNotificationPermission
import com.cbiseo.app.push.StaffPushIntentExtras
import com.cbiseo.app.push.StaffPushRegistration
import com.cbiseo.app.session.StaffRoleResolver

class StaffWebActivity : AppCompatActivity() {
    private lateinit var binding: ActivityStaffWebBinding
    private val tokenStore by lazy { TokenStore.get(this) }
    private var sessionBootstrapDone = false
    private var staffSessionActive = false
    private var notificationSettingsPromptShown = false
    private var openingLoginScreen = false
    private var pendingPushPath: String? = null
    private var systemBarsBottomPx = 0
    private lateinit var appBridge: CbiseoAppBridge

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { _ ->
        if (staffSessionActive) {
            StaffFcmRegistrar.registerToken(this)
        }
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
        binding = ActivityStaffWebBinding.inflate(layoutInflater)
        setContentView(binding.root)
        StaffWindowInsets.apply(this, binding.root, binding.staffWebView) { px ->
            systemBarsBottomPx = px
        }
        pendingPushPath = StaffPushIntentExtras.pushPathFrom(intent)
            ?: intent.getStringExtra(EXTRA_PUSH_PATH)

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
        StaffFcmRegistrar.registerToken(applicationContext)

        appBridge = CbiseoAppBridge(
            appContext = applicationContext,
            onRequestGoogleLogin = {},
            onRequestNotificationPermission = {
                StaffNotificationPermission.promptFromUserAction(this, notificationPermissionLauncher)
                if (staffSessionActive) {
                    registerPushFromWebSession(showToast = false)
                }
            },
            onRegisterPushToken = {
                if (staffSessionActive) {
                    registerPushFromWebSession(showToast = true)
                }
            },
            onSyncAuthToken = { jwt -> tokenStore.updateJwt(jwt) },
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
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (StaffWebSessionSync.urlMatchesApiBase(url, apiBaseUrl)) return false
                    openExternalUrl(url)
                    return true
                }
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
                if (staffSessionActive && sessionBootstrapDone) {
                    registerPushFromWebSession(showToast = false)
                }
                flushPendingPushPath()
            }
        }

        webView.loadUrl("about:blank")
    }

    override fun onResume() {
        super.onResume()
        webViewInForeground = true
        if (staffSessionActive && sessionBootstrapDone) {
            registerPushFromWebSession(showToast = false)
        }
    }

    override fun onPostResume() {
        super.onPostResume()
        StaffNotificationPermission.promptOnAppOpen(this, notificationPermissionLauncher)
        if (staffSessionActive && sessionBootstrapDone) {
            registerPushFromWebSession(showToast = false)
            maybePromptOpenNotificationSettings()
        }
    }

    /** Firebase 권장: 네이티브에서 FCM 토큰 + POST /register (WebView JWT 동기화 후) */
    private fun registerPushFromWebSession(showToast: Boolean) {
        syncSessionFromWebView { jwt ->
            StaffPushRegistration.registerNow(
                context = applicationContext,
                source = "webSession",
                jwtOverride = jwt,
                knownFcmToken = null,
                onFinished = { ok, message ->
                    if (showToast && !isFinishing && !isDestroyed) {
                        Toast.makeText(
                            this,
                            message,
                            if (ok) Toast.LENGTH_SHORT else Toast.LENGTH_LONG,
                        ).show()
                    }
                },
            )
        }
    }

    private fun syncSessionFromWebView(onReady: (String?) -> Unit) {
        StaffWebSessionSync.captureFromWebView(binding.staffWebView) { captured ->
            val token = captured?.token?.trim()?.takeIf { it.isNotBlank() }
            if (!token.isNullOrBlank()) {
                tokenStore.updateJwt(token)
            }
            onReady(token ?: tokenStore.getToken())
        }
    }

    /** Firebase: FCM 토큰은 알림 권한과 무관 — 로그인 세션 있으면 항상 서버 등록 */
    private fun maybePromptOpenNotificationSettings() {
        if (notificationSettingsPromptShown || isFinishing || isDestroyed) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (StaffNotificationPermission.isGranted(this)) return
        if (!StaffNotificationPermission.hasPromptedThisProcess()) return
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
        val path = StaffPushIntentExtras.pushPathFrom(intent)
            ?: intent.getStringExtra(EXTRA_PUSH_PATH)
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

    private fun syncSafeAreaToWebView() {
        StaffWindowInsets.injectSafeAreaCss(activeWebView, systemBarsBottomPx)
    }

    private fun openExternalUrl(url: String) {
        if (url.isBlank()) return
        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }.onFailure {
            Toast.makeText(this, "링크를 열 수 없습니다.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun openLoginScreen(clearSession: Boolean) {
        if (openingLoginScreen || isFinishing) return
        openingLoginScreen = true
        staffSessionActive = false
        if (clearSession) {
            StaffFcmRegistrar.unregisterToken(applicationContext)
            tokenStore.clearSession()
        }
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
