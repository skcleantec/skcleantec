package com.cbiseo.depositalert

import android.app.Application
import com.cbiseo.depositalert.service.KeepAliveService
import com.cbiseo.depositalert.service.scheduleWake
import com.cbiseo.depositalert.store.DeviceSettings

class DepositAlertApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val settings = DeviceSettings(this)
        if (settings.listening() && settings.hasToken()) {
            KeepAliveService.start(this)
            scheduleWake(this)
        }
    }
}
