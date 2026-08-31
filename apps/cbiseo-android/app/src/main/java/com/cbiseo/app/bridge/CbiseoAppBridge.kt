package com.cbiseo.app.bridge



import android.content.Context

import android.os.Handler

import android.os.Looper

import android.webkit.JavascriptInterface

import com.cbiseo.app.BuildConfig

import com.cbiseo.app.push.StaffPushRegistrationStatus

import com.cbiseo.app.push.StaffPushTokenCache

import com.cbiseo.app.update.StaffAppUpdateCoordinator



/** WebView JS — client/src/utils/cbiseoNativeApp.ts */

class CbiseoAppBridge(

    private val appContext: Context,

    private val onRequestGoogleLogin: () -> Unit,

    private val onLoginIdDraftChanged: (String) -> Unit = {},

    private val onRequestNotificationPermission: () -> Unit = {},

    private val onRegisterPushToken: () -> Unit = {},

    private val onSyncAuthToken: (String) -> Unit = {},

    private val onNotifyStaffLogout: () -> Unit = {},

    private val onOpenExternalUrl: (String) -> Unit = {},

    private val updateCoordinator: StaffAppUpdateCoordinator? = null,

) {

    @JavascriptInterface

    fun isNativeApp(): Boolean = true



    @JavascriptInterface

    fun getPlatform(): String = "android"



    @JavascriptInterface

    fun getAppVersionCode(): Int = BuildConfig.VERSION_CODE



    @JavascriptInterface

    fun getAppVersionName(): String = BuildConfig.VERSION_NAME



    /** Play In-App Update 상태 JSON — client/utils/staffAppUpdate.ts */

    @JavascriptInterface

    fun getAppUpdateStatusJson(): String =

        updateCoordinator?.getStatusJson().orEmpty()



    @JavascriptInterface

    fun refreshAppUpdateStatus() {

        Handler(Looper.getMainLooper()).post {

            updateCoordinator?.refreshPlayUpdateStatus(markChecked = false)

        }

    }



    /** flexible(기본) | immediate */

    @JavascriptInterface

    fun startAppUpdate(mode: String) {

        Handler(Looper.getMainLooper()).post {

            updateCoordinator?.requestStartUpdate(mode)

        }

    }



    @JavascriptInterface

    fun completeFlexibleAppUpdate() {

        Handler(Looper.getMainLooper()).post {

            updateCoordinator?.completeFlexibleUpdate()

        }

    }



    @JavascriptInterface

    fun openPlayStore() {

        Handler(Looper.getMainLooper()).post {

            updateCoordinator?.openPlayStore()

        }

    }



    /** http(s) 등 — Chrome·기본 브라우저 등 외부 앱에서 열기 (프로모 배너 등) */

    @JavascriptInterface

    fun openExternalUrl(url: String) {

        Handler(Looper.getMainLooper()).post {

            onOpenExternalUrl(url.trim())

        }

    }



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



    /** WebView 로그아웃 — FCM 서버 해제·TokenStore 정리 (localStorage 비우기 전 호출) */

    @JavascriptInterface

    fun notifyStaffLogout() {

        Handler(Looper.getMainLooper()).post { onNotifyStaffLogout() }

    }

}
