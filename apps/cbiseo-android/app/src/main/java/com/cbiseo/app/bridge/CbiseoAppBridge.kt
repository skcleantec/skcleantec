package com.cbiseo.app.bridge

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import com.cbiseo.app.BuildConfig

/** WebView JS — client/src/utils/cbiseoNativeApp.ts */
class CbiseoAppBridge(
    private val onRequestGoogleLogin: () -> Unit,
    private val onLoginIdDraftChanged: (String) -> Unit = {},
    private val onRequestNotificationPermission: () -> Unit = {},
    private val onRegisterPushToken: () -> Unit = {},
) {
    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun getPlatform(): String = "android"

    @JavascriptInterface
    fun getAppVersionCode(): Int = BuildConfig.VERSION_CODE

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

    /** 팀·관리 레이아웃 — 알림 권한 팝업·FCM 서버 등록 */
    @JavascriptInterface
    fun requestNotificationPermission() {
        Handler(Looper.getMainLooper()).post { onRequestNotificationPermission() }
    }

    /** WebView 홈 로드 후 FCM 토큰 서버 등록 강제 재시도 */
    @JavascriptInterface
    fun registerPushToken() {
        Handler(Looper.getMainLooper()).post { onRegisterPushToken() }
    }
}
