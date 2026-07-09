package com.skcleantec.telecrm.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.dispatch.CallDispatchActivity
import com.skcleantec.telecrm.dispatch.TelecrmDispatchPayload
import com.skcleantec.telecrm.main.MainActivity

object TelecrmNotificationHelper {
    const val CHANNEL_ONGOING = "telecrm_ongoing"
    const val CHANNEL_CALL_DISPATCH = "telecrm_call_dispatch"
    const val CHANNEL_SMS_DISPATCH = "telecrm_sms_dispatch"

    const val NOTIFICATION_ONGOING = 7001
    const val NOTIFICATION_CALL_BASE = 7100

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ONGOING,
                context.getString(R.string.notification_channel_ongoing),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = context.getString(R.string.notification_channel_ongoing_desc)
                setShowBadge(false)
            },
        )

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_CALL_DISPATCH,
                context.getString(R.string.notification_channel_call),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = context.getString(R.string.notification_channel_call_desc)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableVibration(true)
            },
        )

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_SMS_DISPATCH,
                context.getString(R.string.notification_channel_sms),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = context.getString(R.string.notification_channel_sms_desc)
            },
        )
    }

    fun buildOngoingNotification(context: Context, connected: Boolean): Notification {
        ensureChannels(context)
        val openApp = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            pendingIntentFlags(),
        )
        val title = context.getString(R.string.notification_ongoing_title)
        val text = if (connected) {
            context.getString(R.string.notification_ongoing_connected)
        } else {
            context.getString(R.string.notification_ongoing_reconnecting)
        }
        return NotificationCompat.Builder(context, CHANNEL_ONGOING)
            .setSmallIcon(R.drawable.ic_notification_phone)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openApp)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    fun showCallDispatch(context: Context, payload: TelecrmDispatchPayload) {
        ensureChannels(context)
        val digits = payload.phone.filter { it.isDigit() }
        if (digits.length < 4) return

        val notificationId = NOTIFICATION_CALL_BASE + (payload.id?.hashCode()?.and(0xFFFF) ?: digits.hashCode().and(0xFFFF))

        val fullScreenIntent = Intent(context, CallDispatchActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(CallDispatchActivity.EXTRA_PHONE, digits)
            putExtra(CallDispatchActivity.EXTRA_INQUIRY_ID, payload.inquiryId)
            putExtra(CallDispatchActivity.EXTRA_CUSTOMER_MATCH, payload.customerMatch)
            putExtra(CallDispatchActivity.EXTRA_DISPATCH_ID, payload.id)
            putExtra(CallDispatchActivity.EXTRA_ACTION, payload.action)
        }
        val fullScreenPending = PendingIntent.getActivity(
            context,
            notificationId,
            fullScreenIntent,
            pendingIntentFlags(),
        )

        val contentIntent = PendingIntent.getActivity(
            context,
            notificationId + 1,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            pendingIntentFlags(),
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_CALL_DISPATCH)
            .setSmallIcon(R.drawable.ic_notification_phone)
            .setContentTitle(context.getString(R.string.notification_call_title))
            .setContentText(context.getString(R.string.notification_call_body, formatPhone(digits)))
            .setStyle(NotificationCompat.BigTextStyle().bigText(
                context.getString(R.string.notification_call_body, formatPhone(digits)),
            ))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .setFullScreenIntent(fullScreenPending, true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val nm = context.getSystemService(NotificationManager::class.java)
            if (nm?.canUseFullScreenIntent() != true) {
                builder.setFullScreenIntent(null, false)
            }
        }

        NotificationManagerCompat.from(context).notify(notificationId, builder.build())
    }

    fun showSmsDispatch(context: Context, payload: TelecrmDispatchPayload) {
        ensureChannels(context)
        val digits = payload.phone.filter { it.isDigit() }
        if (digits.isEmpty()) return

        val openApp = PendingIntent.getActivity(
            context,
            7200,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            pendingIntentFlags(),
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_SMS_DISPATCH)
            .setSmallIcon(R.drawable.ic_notification_phone)
            .setContentTitle(context.getString(R.string.notification_sms_title))
            .setContentText(context.getString(R.string.notification_sms_body, formatPhone(digits)))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(openApp)
            .build()

        NotificationManagerCompat.from(context).notify(7201, notification)
    }

    fun cancelCallNotification(context: Context, dispatchId: String?) {
        val id = NOTIFICATION_CALL_BASE + (dispatchId?.hashCode()?.and(0xFFFF) ?: 0)
        NotificationManagerCompat.from(context).cancel(id)
    }

    private fun formatPhone(digits: String): String {
        if (digits.length == 11 && digits.startsWith("010")) {
            return "${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7)}"
        }
        return digits
    }

    private fun pendingIntentFlags(): Int {
        val base = PendingIntent.FLAG_UPDATE_CURRENT
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            base or PendingIntent.FLAG_IMMUTABLE
        } else {
            base
        }
    }
}
