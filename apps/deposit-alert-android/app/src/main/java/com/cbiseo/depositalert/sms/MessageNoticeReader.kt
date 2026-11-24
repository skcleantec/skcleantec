package com.cbiseo.depositalert.sms

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.cbiseo.depositalert.store.DeviceSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** 삼성 메시지·Google 메시지 알림의 글만 읽는다. 다른 앱 알림은 보지 않는다. */
class MessageNoticeReader : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val settings = DeviceSettings(this)
        if (!settings.listening() || !settings.messageNotice()) return
        val notice = sbn.notification ?: return
        val extras = notice.extras
        val body = messageNoticeBody(
            sbn.packageName,
            extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
            extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
            (notice.flags and Notification.FLAG_GROUP_SUMMARY) != 0,
        ) ?: return
        Log.i("DepositAlert", "message notice")
        val sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val receivedAt = notice.`when`.takeIf { it > 0L } ?: sbn.postTime
        val appContext = applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            DepositIntake.accept(appContext, sender, body, receivedAt, IntakeSource.Notice)
        }
    }
}
