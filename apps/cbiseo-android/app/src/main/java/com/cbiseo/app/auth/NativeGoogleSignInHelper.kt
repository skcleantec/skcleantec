package com.cbiseo.app.auth

import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * WebView GSI 대신 네이티브 Google Sign-In → id_token을 웹 `/login` 콜백으로 전달.
 * 서버 검증은 웹 `POST /api/auth/oauth/google` (Phase 6)과 동일.
 */
class NativeGoogleSignInHelper(
    private val activity: ComponentActivity,
    private val webView: WebView,
    private val apiBaseUrlProvider: () -> String,
) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val signInLauncher: ActivityResultLauncher<android.content.Intent> =
        activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(ApiException::class.java)
                val idToken = account.idToken?.trim().orEmpty()
                if (idToken.isBlank()) {
                    notifyWebError("Google 인증 토큰을 받지 못했습니다.")
                    return@registerForActivityResult
                }
                notifyWebSuccess(idToken)
            } catch (e: ApiException) {
                val message = when (e.statusCode) {
                    12501 -> "Google 로그인이 취소되었습니다."
                    else -> "Google 로그인에 실패했습니다."
                }
                notifyWebError(message)
            }
        }

    fun requestGoogleLogin() {
        CoroutineScope(Dispatchers.Main).launch {
            val baseUrl = apiBaseUrlProvider().trimEnd('/')
            val clientId = withContext(Dispatchers.IO) { fetchGoogleOAuthClientId(baseUrl) }
            if (clientId.isNullOrBlank()) {
                notifyWebError("Google 로그인 설정을 불러오지 못했습니다.")
                return@launch
            }
            val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(clientId)
                .requestEmail()
                .build()
            val client = GoogleSignIn.getClient(activity, options)
            client.signOut()
            signInLauncher.launch(client.signInIntent)
        }
    }

    private fun fetchGoogleOAuthClientId(baseUrl: String): String? = runCatching {
        val request = Request.Builder()
            .url("$baseUrl/api/public/auth-signup/oauth/google/config")
            .get()
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) return@runCatching null
            val json = JSONObject(raw)
            if (!json.optBoolean("enabled", false)) return@runCatching null
            json.optString("clientId").trim().takeIf { it.isNotBlank() }
        }
    }.getOrNull()

    private fun notifyWebSuccess(idToken: String) {
        val quoted = JSONObject.quote(idToken)
        webView.post {
            webView.evaluateJavascript(
                "window.__cbiseoNativeGoogleLogin&&window.__cbiseoNativeGoogleLogin($quoted)",
                null,
            )
        }
    }

    private fun notifyWebError(message: String) {
        val quoted = JSONObject.quote(message)
        webView.post {
            webView.evaluateJavascript(
                "window.__cbiseoNativeGoogleLoginError&&window.__cbiseoNativeGoogleLoginError($quoted)",
                null,
            )
        }
    }
}
