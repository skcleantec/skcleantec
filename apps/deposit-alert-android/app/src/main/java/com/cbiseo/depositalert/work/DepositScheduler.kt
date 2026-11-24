package com.cbiseo.depositalert.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object DepositScheduler {
    private const val UPLOAD = "deposit-upload"
    private const val HEARTBEAT = "deposit-heartbeat"

    fun enqueueUpload(context: Context) {
        val request = OneTimeWorkRequestBuilder<UploadWorker>()
            .setConstraints(network())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(UPLOAD, ExistingWorkPolicy.KEEP, request)
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
    }

    private fun network() = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
}
