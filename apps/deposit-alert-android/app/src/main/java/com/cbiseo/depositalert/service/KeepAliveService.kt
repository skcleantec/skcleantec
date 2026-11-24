package com.cbiseo.depositalert.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.cbiseo.depositalert.R
import com.cbiseo.depositalert.sms.KEEP_ALIVE_TICK_MS
import com.cbiseo.depositalert.sms.MessageNoticeReader
import com.cbiseo.depositalert.sms.heartbeatDue
import com.cbiseo.depositalert.ui.MainActivity
import com.cbiseo.depositalert.work.DepositScheduler
import com.cbiseo.depositalert.work.HeartbeatPulse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class KeepAliveService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var ticks = 0
    private var tickerOn = false
    private var wakeLock: PowerManager.WakeLock? = null
    private val tickRunnable = Runnable { onTick() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, notification())
        running = true
        if (!scope.isActive) scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        DepositScheduler.ensureHeartbeat(this)
        DepositScheduler.enqueueUpload(this)
        startTicker()
        return START_STICKY
    }

    override fun onDestroy() {
        tickerOn = false
        handler.removeCallbacks(tickRunnable)
        running = false
        scope.cancel()
        wakeLock?.let { if (it.isHeld) it.release() }
        super.onDestroy()
    }

    private fun startTicker() {
        if (tickerOn) return
        tickerOn = true
        Log.i("DepositAlert", "keep alive start")
        handler.postDelayed(tickRunnable, KEEP_ALIVE_TICK_MS)
    }

    private fun onTick() {
        if (!tickerOn) return
        ticks += 1
        val tick = ticks
        val beat = heartbeatDue(tick)
        val lock = cpuLock()
        try {
            if (!lock.isHeld) lock.acquire(25_000L)
        } catch (_: Exception) {
            // 깨우기에 실패해도 살피기는 시도한다.
        }
        scope.launch {
            try {
                MessageNoticeReader.maintain(applicationContext)
                val code = if (beat) HeartbeatPulse.sendAndFollow(applicationContext).code else -1
                Log.i(
                    "DepositAlert",
                    "keep tick=$tick beat=$beat code=$code connected=${MessageNoticeReader.connected}",
                )
            } finally {
                if (lock.isHeld) lock.release()
            }
        }
        handler.postDelayed(tickRunnable, KEEP_ALIVE_TICK_MS)
    }

    private fun cpuLock(): PowerManager.WakeLock {
        val existing = wakeLock
        if (existing != null) return existing
        val created = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "cbiseo:deposit-keep")
            .apply { setReferenceCounted(false) }
        wakeLock = created
        return created
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
