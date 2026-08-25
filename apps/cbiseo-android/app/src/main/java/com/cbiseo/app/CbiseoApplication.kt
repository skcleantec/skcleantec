package com.cbiseo.app

import android.app.Application
import com.cbiseo.app.push.StaffFcmRegistrar
import com.cbiseo.app.push.StaffPushNotificationHelper
import com.cbiseo.app.push.StaffPushRegistration

/** FCM 채널·알림 아이콘은 메시지 수신 전에 준비 (Firebase Android 가이드) */
class CbiseoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        StaffFcmRegistrar.ensureChannels(this)
        StaffPushNotificationHelper.ensureChannel(this)
        StaffPushRegistration.prefetchToken(this)
    }
}
