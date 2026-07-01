package com.skcleantec.telecrm.crm

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.skcleantec.telecrm.BuildConfig
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.LoginActivity
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.bridge.TelecrmAppBridge
import com.skcleantec.telecrm.databinding.ActivityCrmBinding

class CrmActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCrmBinding
    private val tokenStore by lazy { TokenStore(this) }
    private val apiClient = ApiClient()
    private var authPrimed = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val token = tokenStore.getToken()
        if (token.isNullOrBlank()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        binding = ActivityCrmBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val bridge = TelecrmAppBridge(this, tokenStore, apiClient)
        binding.crmWebView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            userAgentString = userAgentString + " SKCleantecTelecrm/0.1"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(binding.crmWebView, true)

        binding.crmWebView.addJavascriptInterface(bridge, "TelecrmApp")
        binding.crmWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString().orEmpty()
                if (url.startsWith("tel:") || url.startsWith("smsto:") || url.startsWith("sms:")) {
                    startActivity(Intent(Intent.ACTION_VIEW, request?.url))
                    return true
                }
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                if (!authPrimed) {
                    authPrimed = true
                    injectAuthToken(view, token)
                    view?.reload()
                    return
                }
                binding.crmProgress.visibility = View.GONE
            }
        }

        val crmUrl = "${BuildConfig.API_BASE_URL}/admin/crm?mobile=1&app=1"
        binding.crmProgress.visibility = View.VISIBLE
        binding.crmWebView.loadUrl(crmUrl)
    }

    private fun injectAuthToken(view: WebView?, token: String) {
        val key = BuildConfig.ADMIN_TOKEN_KEY
        val escaped = token.replace("\\", "\\\\").replace("'", "\\'")
        val script = """
            try {
              localStorage.setItem('$key', '$escaped');
              window.dispatchEvent(new Event('sk_admin_auth'));
            } catch (e) {}
        """.trimIndent()
        view?.evaluateJavascript(script, null)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.crmWebView.canGoBack()) {
            binding.crmWebView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
