package com.cbiseo.app.bridge

import android.webkit.JavascriptInterface

/** WebView JS — client/src/utils/cbiseoNativeApp.ts */
class CbiseoAppBridge {
    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun getPlatform(): String = "android"
}
