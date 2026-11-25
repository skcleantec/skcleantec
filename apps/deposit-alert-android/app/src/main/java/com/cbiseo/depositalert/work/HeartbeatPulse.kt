package com.cbiseo.depositalert.work

import android.content.Context
import android.os.PowerManager
import com.cbiseo.depositalert.BuildConfig
import com.cbiseo.depositalert.net.DepositApi
import com.cbiseo.depositalert.net.HeartbeatResult
import com.cbiseo.depositalert.net.HeartbeatSnapshot
import com.cbiseo.depositalert.net.heartbeatBody
import com.cbiseo.depositalert.service.KeepAliveService
import com.cbiseo.depositalert.sms.InboxScan
import com.cbiseo.depositalert.sms.MessageNoticeReader
import com.cbiseo.depositalert.service.KEEP_ALIVE_TYPE
import com.cbiseo.depositalert.store.DeviceSettings
import com.cbiseo.depositalert.store.NoticeLog
import com.cbiseo.depositalert.store.ServiceHealth

object HeartbeatPulse {
    fun send(context: Context): HeartbeatResult {
        val app = context.applicationContext
        val settings = DeviceSettings(app)
        val token = settings.token()
        if (token.isEmpty()) return HeartbeatResult(0, false)
        val beat = DepositApi().heartbeat(settings.serverBase(), token, heartbeatBody(snapshot(app)))
        if (beat.code == 401) settings.setNeedsReconnect(true)
        if (beat.code in 200..299) settings.setNeedsReconnect(false)
        return beat
    }

    suspend fun sendAndFollow(context: Context): HeartbeatResult {
        val beat = send(context)
        if (beat.rescan) {
            InboxScan.run(context)
            MessageNoticeReader.maintain(context)
        }
        return beat
    }

    private fun snapshot(context: Context): HeartbeatSnapshot {
        val settings = DeviceSettings(context)
        val log = NoticeLog(context)
        val health = ServiceHealth(context)
        val reasons = log.reasonTotals()
        val now = System.currentTimeMillis()
        val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return HeartbeatSnapshot(
            appVersion = BuildConfig.VERSION_NAME,
            listenerConnected = MessageNoticeReader.connected,
            noticeAccessEnabled = MessageNoticeReader.accessEnabled(context),
            keepAliveRunning = KeepAliveService.isRunning(),
            batteryUnrestricted = power.isIgnoringBatteryOptimizations(context.packageName),
            lastNoticeAt = settings.lastNoticeAt(),
            posts = settings.noticePosts(),
            extracted = settings.noticeExtracted(),
            deposits = settings.noticeDeposits(),
            missed = settings.noticeMissed(),
            rebinds = settings.noticeRebinds(),
            sent = settings.noticeSent(),
            alreadySent = reasons.alreadySent,
            otherPath = reasons.otherPath,
            withdrawal = reasons.withdrawal,
            noAmount = reasons.noAmount,
            notNh = reasons.notNh,
            noText = reasons.noText,
            balance = reasons.balance,
            hiddenLost = log.hiddenLostTotal(),
            lastHiddenLostAt = log.lastHiddenLostAt(),
            keepAliveType = KEEP_ALIVE_TYPE,
            lastExitReason = health.lastExitReason(),
            lastExitAt = health.lastExitAt(),
            restarts = health.restartsToday(now),
            fgsTimeoutCount = health.timeoutCount(),
        )
    }
}
