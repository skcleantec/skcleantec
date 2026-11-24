package com.cbiseo.depositalert.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.cbiseo.depositalert.store.DeviceSettings
import com.cbiseo.depositalert.work.DepositScheduler

/** 푸시에는 본문이 없다. 받은 직후 문자함을 한 번만 다시 본다. */
class MmsPushReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action.orEmpty()
        if (!action.contains("WAP_PUSH")) return
        Log.i("DepositAlert", "mms push")
        if (!DeviceSettings(context).listening()) return
        DepositScheduler.enqueueMmsScan(context.applicationContext)
    }
}
