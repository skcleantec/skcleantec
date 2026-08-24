package com.cbiseo.app.bridge

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

/** WebView JS — client/src/utils/cbiseoNativeApp.ts */
class CbiseoAppBridge(
    private val onRequestGoogleLogin: () -> Unit,
    private val onLoginIdDraftChanged: (String) -> Unit = {},
) {
    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun getPlatform(): String = "android"

    /** 로그인 폼 아이디 입력 — pyo/py2일 때만 서버 선택 UI 표시 */
    @JavascriptInterface
    fun notifyLoginIdDraft(raw: String) {
        Handler(Looper.getMainLooper()).post { onLoginIdDraftChanged(raw) }
    }

    /** WebView GSI 실패 시 — 네이티브 Google Sign-In (Phase 8) */
    @JavascriptInterface
    fun requestGoogleLogin() {
        Handler(Looper.getMainLooper()).post { onRequestGoogleLogin() }
    }
}
