package com.skcleantec.telecrm

import android.app.Application
import com.skcleantec.telecrm.auth.TokenStore

/** EncryptedSharedPreferences 초기화를 백그라운드에서 미리 수행 — 첫 화면 ANR 완화 */
class TelecrmApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Thread {
            runCatching { TokenStore.get(this) }
        }.start()
    }
}
