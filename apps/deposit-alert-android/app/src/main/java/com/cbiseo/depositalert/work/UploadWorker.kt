package com.cbiseo.depositalert.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.cbiseo.depositalert.data.DepositDatabase
import com.cbiseo.depositalert.sms.DepositIntake
import com.cbiseo.depositalert.store.DeviceSettings

class UploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        DepositIntake.flush(applicationContext)
        val settings = DeviceSettings(applicationContext)
        if (settings.needsReconnect()) return Result.failure()
        val left = DepositDatabase.get(applicationContext).pending().count()
        return if (left > 0) Result.retry() else Result.success()
    }
}
