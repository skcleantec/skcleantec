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
        if (message.data["type"] != "inbox:refresh") return
        StaffWebActivity.dispatchInboxRefreshToWebView()
    }

    override fun onDeletedMessages() {
        Log.i(TAG, "FCM deleted messages — client should refetch on next open")
    }

    companion object {
        private const val TAG = "CbiseoFcm"
    }
}
