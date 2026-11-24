package com.cbiseo.depositalert.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.app.KeyguardManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.cbiseo.depositalert.R
import com.cbiseo.depositalert.sms.HIDDEN_WINDOW_MS
import com.cbiseo.depositalert.sms.HiddenFollowScheduler
import com.cbiseo.depositalert.sms.HiddenWatchHub
import com.cbiseo.depositalert.sms.KEEP_ALIVE_TICK_MS
import com.cbiseo.depositalert.sms.MessageNoticeReader
import com.cbiseo.depositalert.sms.NoticeRecord
import com.cbiseo.depositalert.sms.NoticeTally
import com.cbiseo.depositalert.sms.heartbeatDue
import com.cbiseo.depositalert.sms.shouldRescanNow
import com.cbiseo.depositalert.sms.showMissedDepositNotice
import com.cbiseo.depositalert.store.NoticeLog
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
    private var hiddenScheduled = false
    private var wakeRegistered = false
    private var wakeLock: PowerManager.WakeLock? = null
    private val tickRunnable = Runnable { onTick() }
    private val hiddenRunnable = Runnable { onHiddenTick() }
    private val wakeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (!shouldRescanNow(intent?.action)) return
            val kind = if (intent?.action == Intent.ACTION_USER_PRESENT) "unlock" else "screen"
            Log.i("DepositAlert", "hidden follow wake $kind")
            holdBriefly()
            scope.launch {
                try {
                    MessageNoticeReader.maintain(applicationContext)
                } finally {
                    wakeLock?.let { if (it.isHeld) it.release() }
                }
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, notification())
        running = true
        if (!scope.isActive) scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        DepositScheduler.ensureHeartbeat(this)
        DepositScheduler.enqueueUpload(this)
        instance = this
        HiddenFollowScheduler.onArm = { armHiddenFollow() }
        registerWake()
        startTicker()
        armHiddenFollow()
        return START_STICKY
    }

    override fun onDestroy() {
        tickerOn = false
        hiddenScheduled = false
        handler.removeCallbacks(tickRunnable)
        handler.removeCallbacks(hiddenRunnable)
        if (instance === this) {
            instance = null
            HiddenFollowScheduler.onArm = null
        }
        if (wakeRegistered) {
            try {
                unregisterReceiver(wakeReceiver)
            } catch (_: Exception) {
                // 이미 풀린 수신기다.
            }
            wakeRegistered = false
        }
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

    private fun armHiddenFollow() {
        if (hiddenScheduled) return
        val delay = HiddenWatchHub.nextPollDelay(System.currentTimeMillis()) ?: return
        hiddenScheduled = true
        handler.postDelayed(hiddenRunnable, delay)
    }

    private fun onHiddenTick() {
        hiddenScheduled = false
        val now = System.currentTimeMillis()
        holdBriefly()
        scope.launch {
            try {
                Log.i("DepositAlert", "hidden follow tick")
                MessageNoticeReader.maintain(applicationContext)
                val lost = HiddenWatchHub.takeLost(System.currentTimeMillis())
                if (lost > 0) noteHiddenLost(lost)
            } finally {
                wakeLock?.let { if (it.isHeld) it.release() }
            }
        }
        val next = HiddenWatchHub.nextPollDelay(now)
        if (next != null) {
            hiddenScheduled = true
            handler.postDelayed(hiddenRunnable, next)
        }
    }

    private fun noteHiddenLost(count: Int) {
        val locked = getSystemService(KeyguardManager::class.java)?.isKeyguardLocked == true
        NoticeLog(applicationContext).add(
            NoticeRecord(
                atMillis = System.currentTimeMillis(),
                methods = "",
                pieces = 0,
                nhPieces = 0,
                depositShape = 0,
                tally = NoticeTally(hiddenLost = count),
                locked = locked,
                summary = false,
            ),
        )
        showMissedDepositNotice(applicationContext, count)
        Log.i("DepositAlert", "hidden lost count=$count")
    }

    private fun registerWake() {
        if (wakeRegistered) return
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
        }
        androidx.core.content.ContextCompat.registerReceiver(
            this,
            wakeReceiver,
            filter,
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        wakeRegistered = true
    }

    private fun holdBriefly() {
        val lock = cpuLock()
        try {
            if (!lock.isHeld) lock.acquire(HIDDEN_WINDOW_MS.coerceAtMost(25_000L))
        } catch (_: Exception) {
            // 깨우기에 실패해도 훑기는 시도한다.
        }
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
        @Volatile private var instance: KeepAliveService? = null

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
