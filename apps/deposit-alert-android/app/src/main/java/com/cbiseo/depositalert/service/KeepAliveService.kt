package com.cbiseo.depositalert.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.cbiseo.depositalert.R
import com.cbiseo.depositalert.ui.MainActivity
import com.cbiseo.depositalert.work.DepositScheduler

class KeepAliveService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, notification())
        running = true
        DepositScheduler.ensureHeartbeat(this)
        DepositScheduler.enqueueUpload(this)
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        super.onDestroy()
    }

    private fun notification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "입금 알림 유지", NotificationManager.IMPORTANCE_LOW),
            )
        }
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_deposit)
            .setContentTitle("청소비서 입금 알림")
            .setContentText("입금 문자를 서버로 보내고 있습니다")
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "deposit-alert-keep"
        private const val NOTIFICATION_ID = 41
        @Volatile private var running = false

        fun isRunning(): Boolean = running

        fun start(context: Context) {
            try {
                val intent = Intent(context, KeepAliveService::class.java)
                androidx.core.content.ContextCompat.startForegroundService(context, intent)
            } catch (_: Exception) {
                // 화면이 앞에 있을 때 다시 켠다.
            }
        }

        fun stop(context: Context) {
            DepositScheduler.stop(context)
            context.stopService(Intent(context, KeepAliveService::class.java))
        }
    }
}
