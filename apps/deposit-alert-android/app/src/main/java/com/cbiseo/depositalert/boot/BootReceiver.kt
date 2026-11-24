package com.cbiseo.depositalert.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.cbiseo.depositalert.service.KeepAliveService
import com.cbiseo.depositalert.store.DeviceSettings

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val settings = DeviceSettings(context)
        if (settings.listening() && settings.hasToken()) KeepAliveService.start(context)
    }
}
