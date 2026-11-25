package com.cbiseo.depositalert.sms

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.cbiseo.depositalert.R
import com.cbiseo.depositalert.ui.MainActivity

fun missedDepositNoticeText(count: Int): String {
    val shown = count.coerceAtLeast(1)
    return "입금 문자 ${shown}건을 읽지 못했어요. 눌러서 확인"
}

fun showMissedDepositNotice(context: Context, count: Int) {
    if (count <= 0) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "입금 확인", NotificationManager.IMPORTANCE_HIGH),
        )
    }
    val open = PendingIntent.getActivity(
        context,
        0,
        Intent(context, MainActivity::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val notice = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_deposit)
        .setContentTitle("청소비서 입금 알림")
        .setContentText(missedDepositNoticeText(count))
        .setContentIntent(open)
        .setAutoCancel(true)
        .build()
    manager.notify(NOTIFICATION_ID, notice)
}

fun wakePromptText(): String {
    return "입금 알림 앱을 한 번 열어 주세요. 지금 입금을 서버로 보내지 못하고 있어요."
}

fun showWakePrompt(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(WAKE_CHANNEL) == null) {
        manager.createNotificationChannel(
            NotificationChannel(WAKE_CHANNEL, "입금 알림 확인", NotificationManager.IMPORTANCE_HIGH),
        )
    }
    val open = PendingIntent.getActivity(
        context,
        1,
        Intent(context, MainActivity::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val notice = NotificationCompat.Builder(context, WAKE_CHANNEL)
        .setSmallIcon(R.drawable.ic_stat_deposit)
        .setContentTitle("청소비서 입금 알림")
        .setContentText(wakePromptText())
        .setStyle(NotificationCompat.BigTextStyle().bigText(wakePromptText()))
        .setContentIntent(open)
        .setAutoCancel(true)
        .build()
    manager.notify(WAKE_ID, notice)
}

fun dismissWakePrompt(context: Context) {
    context.getSystemService(NotificationManager::class.java)?.cancel(WAKE_ID)
}

private const val CHANNEL_ID = "deposit-alert-missed"
private const val NOTIFICATION_ID = 42
private const val WAKE_CHANNEL = "deposit-alert-wake"
private const val WAKE_ID = 43
