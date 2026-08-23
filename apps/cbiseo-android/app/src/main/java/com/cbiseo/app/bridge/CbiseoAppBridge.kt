package com.cbiseo.app.bridge

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

/** WebView JS — client/src/utils/cbiseoNativeApp.ts */
class CbiseoAppBridge(
    private val onRequestGoogleLogin: () -> Unit,
) {
    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun getPlatform(): String = "android"

    /** WebView GSI 실패 시 — 네이티브 Google Sign-In (Phase 8) */
    @JavascriptInterface
    fun requestGoogleLogin() {
        Handler(Looper.getMainLooper()).post { onRequestGoogleLogin() }
    }
}
