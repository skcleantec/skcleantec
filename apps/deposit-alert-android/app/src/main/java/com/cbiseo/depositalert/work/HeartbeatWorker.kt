package com.cbiseo.depositalert.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.cbiseo.depositalert.net.DepositApi
import com.cbiseo.depositalert.service.KeepAliveService
import com.cbiseo.depositalert.sms.InboxScan
import com.cbiseo.depositalert.sms.MessageNoticeReader
import com.cbiseo.depositalert.store.DeviceSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class HeartbeatWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val settings = DeviceSettings(applicationContext)
        if (settings.listening() && !KeepAliveService.isRunning()) {
            KeepAliveService.start(applicationContext)
        }
        InboxScan.run(applicationContext)
        MessageNoticeReader.maintain(applicationContext)
        val token = settings.token()
        if (token.isEmpty()) return@withContext Result.success()
        val beat = DepositApi().heartbeat(settings.serverBase(), token)
        if (beat.code == 401) settings.setNeedsReconnect(true)
        if (beat.code in 200..299) settings.setNeedsReconnect(false)
        if (beat.rescan) {
            InboxScan.run(applicationContext)
            MessageNoticeReader.maintain(applicationContext)
        }
        Result.success()
    }
}
