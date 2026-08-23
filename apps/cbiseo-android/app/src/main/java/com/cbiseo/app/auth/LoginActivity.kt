package com.cbiseo.app.auth

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.cbiseo.app.R
import com.cbiseo.app.api.ApiEnvironment
import com.cbiseo.app.bridge.CbiseoAppBridge
import com.cbiseo.app.databinding.ActivityLoginBinding
import com.cbiseo.app.session.StaffRoleResolver
import com.cbiseo.app.web.StaffWebActivity
import com.cbiseo.app.web.StaffWebSessionSync
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
    private lateinit var nativeGoogleSignIn: NativeGoogleSignInHelper

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        nativeGoogleSignIn = NativeGoogleSignInHelper(
            activity = this,
            webView = binding.loginWebView,
            apiBaseUrlProvider = { selectedApiBaseUrl() },
        )

        setupServerPresetForPyo()
        setupLoginWebView()
        loadLoginPage()
    }

    private fun setupServerPresetForPyo() {
        val storedLoginId = tokenStore.getLoginId().orEmpty()
        if (!ApiEnvironment.canChooseServer(storedLoginId)) {
            binding.serverPresetSection.visibility = View.GONE
            return
        }
        binding.serverPresetSection.visibility = View.VISIBLE
        ensureServerPresetBound()
        binding.serverPresetGroup.addOnButtonCheckedListener { _: MaterialButtonToggleGroup, _: Int, isChecked: Boolean ->
            if (!isChecked || !loginPageBootstrapped) return@addOnButtonCheckedListener
            loadLoginPage(reload = true)
        }
    }

    private fun ensureServerPresetBound() {
        if (serverPresetBound) return
        serverPresetBound = true
        val preset = ApiEnvironment.presetForUrl(tokenStore.getApiBaseUrl()) ?: ApiEnvironment.Preset.PRODUCTION
        binding.serverPresetGroup.check(
            when (preset) {
                ApiEnvironment.Preset.PRODUCTION -> R.id.serverPresetProduction
                ApiEnvironment.Preset.STAGING -> R.id.serverPresetStaging
            },
        )
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

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupLoginWebView() {
        val webView = binding.loginWebView
        CookieManager.getInstance().setAcceptCookie(true)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.addJavascriptInterface(
            CbiseoAppBridge(onRequestGoogleLogin = { nativeGoogleSignIn.requestGoogleLogin() }),
            "CbiseoApp",
        )

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString().orEmpty()
                if (url.startsWith("http://") || url.startsWith("https://")) return false
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                val current = url ?: return
                val apiBaseUrl = selectedApiBaseUrl()

                if (!loginPageBootstrapped) {
                    if (current == "about:blank") {
                        loginPageBootstrapped = true
                        injectStaffAppFlag(webView)
                        webView.loadUrl("$apiBaseUrl/login")
                    }
                    return
                }

                if (!current.startsWith(apiBaseUrl)) return

                if (StaffWebSessionSync.isStaffAppHomeUrl(current, apiBaseUrl)) {
                    tryFinishLoginFromWeb(webView, apiBaseUrl)
                }
            }
        }
    }

    private fun loadLoginPage(reload: Boolean = false) {
        if (reload) loginPageBootstrapped = false
        binding.loginWebView.loadUrl("about:blank")
    }

    private fun injectStaffAppFlag(webView: WebView) {
        webView.evaluateJavascript(
            "try{localStorage.setItem('cbiseo_staff_app','1');}catch(e){}",
            null,
        )
    }

    private fun tryFinishLoginFromWeb(webView: WebView, apiBaseUrl: String) {
        if (finishingAfterAuth) return
        StaffWebSessionSync.captureFromWebView(webView) { captured ->
            val token = captured?.token
            val role = captured?.role ?: JwtPayload.roleFromToken(token)
            if (token.isNullOrBlank() || StaffRoleResolver.homePathForRole(role) == null) return@captureFromWebView
            finishingAfterAuth = true
            tokenStore.saveSession(
                token = token,
                tenantSlug = captured.tenantSlug.orEmpty(),
                loginId = tokenStore.getLoginId().orEmpty(),
                userName = null,
                userId = null,
                role = role,
                apiBaseUrl = apiBaseUrl,
            )
            startActivity(Intent(this, StaffWebActivity::class.java))
            finish()
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
}
