package com.cbiseo.app.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.cbiseo.app.R
import com.cbiseo.app.web.StaffWebActivity

object StaffPushNotificationHelper {
    const val CHANNEL_ID = "cbiseo_staff_default"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.fcm_default_channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = context.getString(R.string.fcm_default_channel_description)
        }
        manager.createNotificationChannel(channel)
    }

    fun showNavigateNotification(
        context: Context,
        title: String,
        body: String,
        path: String,
        notificationId: Int,
    ) {
        ensureChannel(context)
        val launchIntent = Intent(context, StaffWebActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            if (path.isNotBlank()) {
                putExtra(StaffWebActivity.EXTRA_PUSH_PATH, path)
            }
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val safeTitle = title.ifBlank { context.getString(R.string.app_name) }
        val safeBody = body.ifBlank { context.getString(R.string.fcm_default_body) }
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setContentTitle(safeTitle)
            .setContentText(safeBody)
            .setStyle(NotificationCompat.BigTextStyle().bigText(safeBody))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.notify(notificationId, notification)
    }
}
