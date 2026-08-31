package com.cbiseo.app.auth

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.cbiseo.app.R
import com.cbiseo.app.push.StaffFcmRegistrar
import com.cbiseo.app.push.StaffNotificationPermission
import com.cbiseo.app.api.ApiEnvironment
import com.cbiseo.app.bridge.CbiseoAppBridge
import com.cbiseo.app.databinding.ActivityLoginBinding
import com.cbiseo.app.session.StaffRoleResolver
import com.cbiseo.app.web.StaffWebActivity
import com.cbiseo.app.web.StaffWebSessionSync
import com.cbiseo.app.web.StaffWindowInsets
import com.google.android.material.button.MaterialButtonToggleGroup

/**
 * PC와 동일한 `/login` 웹 UI(WebView).
 * Google GSI는 WebView에서 실패 → 네이티브 Google Sign-In(Phase 8) 또는 카카오·아이디 로그인.
 */
class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private val tokenStore by lazy { TokenStore.get(this) }
    private var serverPresetBound = false
    private var loginPageBootstrapped = false
    private var finishingAfterAuth = false
    private var draftLoginId: String? = null
    private var suppressPresetListener = false
    private var loadedLoginApiBaseUrl: String? = null
    private var pendingFormRestore: StaffWebSessionSync.LoginFormDraft? = null
    private var navBarBottomPx = 0
    private lateinit var nativeGoogleSignIn: NativeGoogleSignInHelper

    private val presetVisibilityHandler = Handler(Looper.getMainLooper())
    private var presetVisibilityRunnable: Runnable? = null

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        StaffWindowInsets.applyLogin(this, binding.root, binding.loginWebView) { px ->
            navBarBottomPx = px
        }

        nativeGoogleSignIn = NativeGoogleSignInHelper(
            activity = this,
            webView = binding.loginWebView,
            apiBaseUrlProvider = { selectedApiBaseUrl() },
        )

        setupServerPreset()
        setupLoginWebView()
        loadLoginPage()
    }

    override fun onPostResume() {
        super.onPostResume()
        StaffNotificationPermission.promptOnAppOpen(this, notificationPermissionLauncher)
    }

    override fun onDestroy() {
        presetVisibilityRunnable?.let { presetVisibilityHandler.removeCallbacks(it) }
        super.onDestroy()
    }

    private fun setupServerPreset() {
        binding.serverPresetSection.visibility = View.GONE
        binding.serverPresetGroup.addOnButtonCheckedListener { _: MaterialButtonToggleGroup, _: Int, isChecked: Boolean ->
            if (!isChecked || !loginPageBootstrapped || suppressPresetListener) return@addOnButtonCheckedListener
            switchLoginServerIfNeeded()
        }
    }

    /** 로그인 폼에 입력 중인 아이디만 본다 (저장된 세션 loginId로는 선택창을 띄우지 않음) */
    private fun effectiveLoginIdForServerChoice(): String? =
        draftLoginId?.trim()?.lowercase()?.takeIf { it.isNotBlank() }

    /** pyo/pyo2 입력 직후 즉시 UI·WebView를 건드리지 않도록 디바운스 */
    private fun scheduleServerPresetVisibilityRefresh() {
        presetVisibilityRunnable?.let { presetVisibilityHandler.removeCallbacks(it) }
        val runnable = Runnable { applyServerPresetVisibility() }
        presetVisibilityRunnable = runnable
        presetVisibilityHandler.postDelayed(runnable, PRESET_VISIBILITY_DEBOUNCE_MS)
    }

    private fun applyServerPresetVisibility() {
        if (!ApiEnvironment.canChooseServer(effectiveLoginIdForServerChoice())) {
            binding.serverPresetSection.visibility = View.GONE
            serverPresetBound = false
            return
        }
        binding.serverPresetSection.visibility = View.VISIBLE
        ensureServerPresetBound()
    }

    private fun ensureServerPresetBound() {
        if (serverPresetBound) return
        serverPresetBound = true
        val preset = ApiEnvironment.presetForUrl(tokenStore.getApiBaseUrl()) ?: ApiEnvironment.Preset.PRODUCTION
        suppressPresetListener = true
        try {
            binding.serverPresetGroup.check(
                when (preset) {
                    ApiEnvironment.Preset.PRODUCTION -> R.id.serverPresetProduction
                    ApiEnvironment.Preset.STAGING -> R.id.serverPresetStaging
                },
            )
        } finally {
            suppressPresetListener = false
        }
    }

    private fun selectedApiBaseUrl(): String {
        if (binding.serverPresetSection.visibility == View.VISIBLE) {
            return when (binding.serverPresetGroup.checkedButtonId) {
                R.id.serverPresetStaging -> ApiEnvironment.STAGING_URL
                else -> ApiEnvironment.PRODUCTION_URL
            }
        }
        return ApiEnvironment.presetForUrl(tokenStore.getApiBaseUrl())?.url
            ?: ApiEnvironment.PRODUCTION_URL
    }

    /** 운영↔스테이징 전환 — about:blank 리셋 없이 로그인 URL만 교체 + 입력값 복원 */
    private fun switchLoginServerIfNeeded() {
        val target = selectedApiBaseUrl()
        if (target == loadedLoginApiBaseUrl) return
        val webView = binding.loginWebView
        StaffWebSessionSync.readLoginFormDraft(webView) { draft ->
            pendingFormRestore = draft
            loadedLoginApiBaseUrl = target
            webView.loadUrl("$target/login")
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupLoginWebView() {
        val webView = binding.loginWebView
        CookieManager.getInstance().setAcceptCookie(true)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.addJavascriptInterface(
            CbiseoAppBridge(
                appContext = applicationContext,
                onRequestGoogleLogin = { nativeGoogleSignIn.requestGoogleLogin() },
                onLoginIdDraftChanged = { raw ->
                    draftLoginId = raw.trim().lowercase().takeIf { it.isNotBlank() }
                    scheduleServerPresetVisibilityRefresh()
                },
            ),
            "CbiseoApp",
        )

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString().orEmpty()
                if (url.startsWith("http://") || url.startsWith("https://")) return false
                val lower = url.lowercase()
                if (
                    lower.startsWith("tel:") ||
                    lower.startsWith("mailto:") ||
                    lower.startsWith("sms:") ||
                    lower.startsWith("smsto:")
                ) {
                    runCatching {
                        val intent =
                            if (lower.startsWith("tel:")) {
                                Intent(Intent.ACTION_DIAL, Uri.parse(url))
                            } else {
                                Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            }
                        startActivity(intent)
                    }.onFailure {
                        Toast.makeText(this@LoginActivity, "링크를 열 수 없습니다.", Toast.LENGTH_SHORT).show()
                    }
                    return true
                }
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                val current = url ?: return
                val apiBaseUrl = selectedApiBaseUrl()

                if (!loginPageBootstrapped) {
                    if (current == "about:blank") {
                        loginPageBootstrapped = true
                        loadedLoginApiBaseUrl = apiBaseUrl
                        injectStaffAppFlag(webView)
                        webView.loadUrl("$apiBaseUrl/login")
                    }
                    return
                }

                if (!current.startsWith(apiBaseUrl)) return

                if (StaffWebSessionSync.isStaffWebLoginUrl(current, apiBaseUrl)) {
                    loadedLoginApiBaseUrl = apiBaseUrl
                    bindLoginIdDraftWatcher(webView)
                    restorePendingLoginForm(webView)
                    StaffWindowInsets.injectSafeAreaCss(webView, navBarBottomPx)
                }

                if (StaffWebSessionSync.isStaffAppHomeUrl(current, apiBaseUrl)) {
                    tryFinishLoginFromWeb(webView, apiBaseUrl)
                }
            }
        }
    }

    private fun restorePendingLoginForm(webView: WebView) {
        val draft = pendingFormRestore ?: return
        pendingFormRestore = null
        webView.postDelayed({
            if (isFinishing || isDestroyed) return@postDelayed
            StaffWebSessionSync.injectLoginFormDraft(webView, draft)
            draftLoginId = draft.loginId.trim().lowercase().takeIf { it.isNotBlank() }
            scheduleServerPresetVisibilityRefresh()
        }, 120L)
    }

    private fun loadLoginPage() {
        loginPageBootstrapped = false
        loadedLoginApiBaseUrl = null
        binding.loginWebView.loadUrl("about:blank")
    }

    private fun injectStaffAppFlag(webView: WebView) {
        webView.evaluateJavascript(
            "try{localStorage.setItem('cbiseo_staff_app','1');}catch(e){}",
            null,
        )
    }

    private fun bindLoginIdDraftWatcher(webView: WebView) {
        webView.evaluateJavascript(LOGIN_ID_DRAFT_WATCHER_SCRIPT, null)
        scheduleLoginIdDraftSync(webView, delayMs = 400L)
        scheduleLoginIdDraftSync(webView, delayMs = 1200L)
    }

    private fun scheduleLoginIdDraftSync(webView: WebView, delayMs: Long) {
        webView.postDelayed({
            if (isFinishing || isDestroyed) return@postDelayed
            StaffWebSessionSync.readLoginIdFromWebView(webView) { loginId ->
                draftLoginId = loginId
                scheduleServerPresetVisibilityRefresh()
            }
            webView.evaluateJavascript(LOGIN_ID_DRAFT_WATCHER_SCRIPT, null)
        }, delayMs)
    }

    private fun tryFinishLoginFromWeb(webView: WebView, apiBaseUrl: String) {
        if (finishingAfterAuth) return
        StaffWebSessionSync.captureFromWebView(webView) { captured ->
            val token = captured?.token
            val role = captured?.role ?: JwtPayload.roleFromToken(token)
            if (token.isNullOrBlank() || StaffRoleResolver.homePathForRole(role) == null) return@captureFromWebView
            finishingAfterAuth = true
            val loginId = JwtPayload.emailFromToken(token)
                ?: draftLoginId
                ?: tokenStore.getLoginId().orEmpty()
            val oldJwt = tokenStore.getToken()?.trim()?.takeIf { it.isNotBlank() }
            fun openStaffHome() {
                tokenStore.saveSession(
                    token = token,
                    tenantSlug = captured.tenantSlug.orEmpty(),
                    loginId = loginId,
                    userName = null,
                    userId = null,
                    role = role,
                    apiBaseUrl = apiBaseUrl,
                )
                StaffFcmRegistrar.registerTokenForce(applicationContext, jwtOverride = token)
                startActivity(Intent(this, StaffWebActivity::class.java))
                finish()
            }
            if (oldJwt != null && oldJwt != token.trim()) {
                StaffFcmRegistrar.unregisterBeforeAccountSwitch(applicationContext, oldJwt) {
                    openStaffHome()
                }
            } else {
                openStaffHome()
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.loginWebView.canGoBack()) {
            binding.loginWebView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    companion object {
        private const val PRESET_VISIBILITY_DEBOUNCE_MS = 450L

        /** React `/login` — onPageFinished 시점엔 #login-id 가 아직 없을 수 있음 */
        private val LOGIN_ID_DRAFT_WATCHER_SCRIPT = """
            (function(){
              if (window.__cbiseoLoginIdWatcher) {
                window.__cbiseoLoginIdDraftRescan && window.__cbiseoLoginIdDraftRescan();
                return;
              }
              window.__cbiseoLoginIdWatcher = true;
              var last = '';
              function push(v) {
                var next = (v || '').trim();
                if (next === last) return;
                last = next;
                try { CbiseoApp.notifyLoginIdDraft(next); } catch (e) {}
              }
              function bind(el) {
                if (!el || el.dataset.cbiseoPresetBound) return;
                el.dataset.cbiseoPresetBound = '1';
                el.addEventListener('input', function(){ push(el.value); });
                el.addEventListener('change', function(){ push(el.value); });
                push(el.value);
              }
              function rescan() {
                bind(document.getElementById('login-id'));
              }
              window.__cbiseoLoginIdDraftRescan = rescan;
              rescan();
              try {
                new MutationObserver(rescan).observe(document.documentElement, { childList: true, subtree: true });
              } catch (e) {}
              var n = 0;
              var t = setInterval(function(){
                rescan();
                n += 1;
                if (n >= 30) clearInterval(t);
              }, 500);
            })();
        """.trimIndent()
    }
}
