package com.cbiseo.depositalert.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.cbiseo.depositalert.net.DepositApi
import com.cbiseo.depositalert.store.DeviceSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class HeartbeatWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val settings = DeviceSettings(applicationContext)
        val token = settings.token()
        if (token.isEmpty()) return@withContext Result.success()
        val code = DepositApi().heartbeat(settings.serverBase(), token)
        if (code == 401) settings.setNeedsReconnect(true)
        if (code in 200..299) settings.setNeedsReconnect(false)
        Result.success()
    }
}
