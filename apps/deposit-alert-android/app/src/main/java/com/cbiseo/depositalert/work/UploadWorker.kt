package com.cbiseo.depositalert.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.cbiseo.depositalert.data.DepositDatabase
import com.cbiseo.depositalert.sms.DepositIntake
import com.cbiseo.depositalert.store.DeviceSettings

class UploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val before = DepositDatabase.get(applicationContext).pending().count()
        DepositIntake.flush(applicationContext)
        val settings = DeviceSettings(applicationContext)
        if (settings.needsReconnect()) return Result.failure()
        val after = DepositDatabase.get(applicationContext).pending().count()
        return if (after > 0 && after >= before) Result.retry() else Result.success()
    }
}
