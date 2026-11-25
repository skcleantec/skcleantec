package com.cbiseo.depositalert.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.cbiseo.depositalert.sms.DepositIntake
import com.cbiseo.depositalert.sms.MessageNoticeReader
import com.cbiseo.depositalert.store.DeviceSettings
import com.cbiseo.depositalert.work.HeartbeatPulse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** 10분마다 서비스를 살피고 상태를 보낸다. 서비스가 없으면 다시 올린다. */
class WakeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val app = context.applicationContext
        val settings = DeviceSettings(app)
        if (!settings.listening() || !settings.hasToken()) return
        scheduleWake(app)
        if (!KeepAliveService.isRunning()) KeepAliveService.start(app)
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                MessageNoticeReader.maintain(app)
                DepositIntake.sendQueued(app)
                HeartbeatPulse.send(app)
            } finally {
                pending.finish()
            }
        }
    }
}
