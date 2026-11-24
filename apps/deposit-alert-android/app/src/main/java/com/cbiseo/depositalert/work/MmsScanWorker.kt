package com.cbiseo.depositalert.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.cbiseo.depositalert.sms.InboxScan

/** 멀티미디어 문자가 문자함에 들어간 뒤에 점검 한 번. */
class MmsScanWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        InboxScan.run(applicationContext)
        return Result.success()
    }
}
