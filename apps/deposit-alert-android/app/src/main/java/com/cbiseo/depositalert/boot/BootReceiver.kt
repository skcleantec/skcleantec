package com.cbiseo.depositalert.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.cbiseo.depositalert.service.KeepAliveService
import com.cbiseo.depositalert.service.scheduleWake
import com.cbiseo.depositalert.store.DeviceSettings

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        val settings = DeviceSettings(context)
        if (settings.listening() && settings.hasToken()) {
            KeepAliveService.start(context)
            scheduleWake(context)
        }
    }
}
