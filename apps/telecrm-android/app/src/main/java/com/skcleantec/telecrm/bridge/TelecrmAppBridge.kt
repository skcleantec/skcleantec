package com.skcleantec.telecrm.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.realtime.AppEventBus
import com.skcleantec.telecrm.telephony.TelecrmCallHelper

/** WebView JS 브릿지 (웹 CRM 연동 시). 네이티브 앱은 TelecrmCallHelper 직접 사용. */
class TelecrmAppBridge(
    private val context: Context,
    private val tokenStore: TokenStore,
    private val apiClient: ApiClient,
) {
    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    /** 다이얼 입력란에만 번호 채움 — 전화 앱·자동 발신 없음 */
    @JavascriptInterface
    fun prefillPhone(phone: String, inquiryId: String?) {
        val digits = phone.filter { it.isDigit() }
        if (digits.length < 4) return
        AppEventBus.emitDialPrefill(
            digits,
            inquiryId?.takeIf { it.isNotBlank() },
            null,
        )
    }

    @JavascriptInterface
    fun call(phone: String, inquiryId: String?) {
        TelecrmCallHelper.dial(context, phone)
        val token = tokenStore.getToken() ?: return
        TelecrmCallHelper.logOutboundCall(context, apiClient, token, phone, inquiryId, "unknown")
    }

    @JavascriptInterface
    fun sms(phone: String, body: String) {
        TelecrmCallHelper.openSms(context, phone, body)
    }
}
