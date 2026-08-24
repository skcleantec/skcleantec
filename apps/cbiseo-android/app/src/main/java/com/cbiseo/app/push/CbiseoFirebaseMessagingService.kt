package com.cbiseo.app.push

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.cbiseo.app.web.StaffWebActivity

class CbiseoFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        StaffFcmRegistrar.registerToken(applicationContext)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        when (data["type"]) {
            "staff-app:navigate" -> handleNavigatePush(data)
            "inbox:refresh" -> StaffWebActivity.dispatchInboxRefreshToWebView()
            else -> Unit
        }
    }

    private fun handleNavigatePush(data: Map<String, String>) {
        val title = data["title"].orEmpty()
        val body = data["body"].orEmpty()
        val path = data["path"].orEmpty()
        val kind = data["kind"].orEmpty()

        if (StaffWebActivity.isWebViewInForeground()) {
            StaffWebActivity.dispatchInboxRefreshToWebView()
            if (path.isNotBlank()) {
                StaffWebActivity.dispatchNavigateToWebView(path)
            }
            return
        }

        val notificationId = (kind + path + title).hashCode()
        StaffPushNotificationHelper.showNavigateNotification(
            context = applicationContext,
            title = title,
            body = body,
            path = path,
            notificationId = notificationId,
        )
    }

    override fun onDeletedMessages() {
        Log.i(TAG, "FCM deleted messages — client should refetch on next open")
    }

    companion object {
        private const val TAG = "CbiseoFcm"
    }
}
