package com.cbiseo.depositalert.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object DepositScheduler {
    private const val UPLOAD = "deposit-upload"
    private const val HEARTBEAT = "deposit-heartbeat"
    private const val MMS_SCAN = "deposit-mms-scan"

    fun enqueueMmsScan(context: Context) {
        val request = OneTimeWorkRequestBuilder<MmsScanWorker>()
            .setInitialDelay(12, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(MMS_SCAN, ExistingWorkPolicy.REPLACE, request)
    }

    fun enqueueUpload(context: Context, expedited: Boolean = false) {
        val builder = OneTimeWorkRequestBuilder<UploadWorker>()
            .setConstraints(network())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        if (expedited) builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
        val policy = if (expedited) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP
        WorkManager.getInstance(context).enqueueUniqueWork(UPLOAD, policy, builder.build())
    }

    fun ensureHeartbeat(context: Context) {
        val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
            .setConstraints(network())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            HEARTBEAT,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }

    fun stop(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(UPLOAD)
        WorkManager.getInstance(context).cancelUniqueWork(HEARTBEAT)
        WorkManager.getInstance(context).cancelUniqueWork(MMS_SCAN)
    }

    private fun network() = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
}
