package com.skcleantec.telecrm.bridge

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.widget.Toast
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import org.json.JSONObject

/** WebView JS: window.TelecrmApp.call / sms / isNativeApp */
class TelecrmAppBridge(
    private val context: Context,
    private val tokenStore: TokenStore,
    private val apiClient: ApiClient,
) {
    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun call(phone: String, inquiryId: String?) {
        val digits = phone.filter { it.isDigit() }
        if (digits.length < 4) return
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        logOutboundCall(digits, inquiryId)
    }

    @JavascriptInterface
    fun sms(phone: String, body: String) {
        val digits = phone.filter { it.isDigit() }
        if (digits.isEmpty()) return
        val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$digits"))
        intent.putExtra("sms_body", body)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    private fun logOutboundCall(phone: String, inquiryId: String?) {
        val token = tokenStore.getToken() ?: return
        Thread {
            val payload = JSONObject()
                .put("phone", phone)
                .put("direction", "OUTBOUND")
                .put("customerMatch", "unknown")
            if (!inquiryId.isNullOrBlank()) {
                payload.put("inquiryId", inquiryId)
            }
            apiClient.postCallSession(token, payload).onFailure {
                // 내부 테스트 — UI 스레드 토스트만
                android.os.Handler(context.mainLooper).post {
                    Toast.makeText(context, "통화 기록 저장 실패", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }
}
