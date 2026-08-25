package com.cbiseo.app.bridge



import android.content.Context

import android.os.Handler

import android.os.Looper

import android.webkit.JavascriptInterface

import com.cbiseo.app.BuildConfig

import com.cbiseo.app.push.StaffPushRegistrationStatus

import com.cbiseo.app.push.StaffPushTokenCache



/** WebView JS — client/src/utils/cbiseoNativeApp.ts */

class CbiseoAppBridge(

    private val appContext: Context,

    private val onRequestGoogleLogin: () -> Unit,

    private val onLoginIdDraftChanged: (String) -> Unit = {},

    private val onRequestNotificationPermission: () -> Unit = {},

    private val onRegisterPushToken: () -> Unit = {},

    private val onSyncAuthToken: (String) -> Unit = {},

) {

    @JavascriptInterface

    fun isNativeApp(): Boolean = true



    @JavascriptInterface

    fun getPlatform(): String = "android"



    @JavascriptInterface

    fun getAppVersionCode(): Int = BuildConfig.VERSION_CODE



    /** WebView localStorage JWT → TokenStore (FCM 서버 등록용) */

    @JavascriptInterface

    fun syncAuthToken(jwt: String) {

        Handler(Looper.getMainLooper()).post { onSyncAuthToken(jwt.trim()) }

    }



    /** 네이티브 FCM 등록 진행 상태 — CustomEvent 대신 JS 폴링 */

    @JavascriptInterface

    fun getPushRegisterStatus(): String = StaffPushRegistrationStatus.toJson()



    /** onNewToken·prefetch 캐시 — 웹 POST 백업용 */

    @JavascriptInterface

    fun getCachedFcmToken(): String = StaffPushTokenCache.get(appContext).orEmpty()



    @JavascriptInterface

    fun notifyLoginIdDraft(raw: String) {

        Handler(Looper.getMainLooper()).post { onLoginIdDraftChanged(raw) }

    }



    @JavascriptInterface

    fun requestGoogleLogin() {

        Handler(Looper.getMainLooper()).post { onRequestGoogleLogin() }

    }



    @JavascriptInterface

    fun requestNotificationPermission() {

        Handler(Looper.getMainLooper()).post { onRequestNotificationPermission() }

    }



    @JavascriptInterface

    fun registerPushToken() {

        Handler(Looper.getMainLooper()).post { onRegisterPushToken() }

    }

}

