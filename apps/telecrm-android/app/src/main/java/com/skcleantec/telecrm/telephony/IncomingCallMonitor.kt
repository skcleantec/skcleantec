package com.skcleantec.telecrm.telephony

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat

/** SIM 수신 벨 감지 → CRM lookup + full-screen 수신 UI */
object IncomingCallMonitor {
    private var receiver: BroadcastReceiver? = null
    private var isRinging = false
    private var lastRingPhone: String? = null
    private var answeredThisRing = false

    fun restart(context: Context) {
        stop(context)
        start(context)
    }

    fun start(context: Context) {
        if (receiver != null) return
        if (!hasPhoneStatePermission(context)) return

        val app = context.applicationContext
        val filter = IntentFilter(TelephonyManager.ACTION_PHONE_STATE_CHANGED)
        val r = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
                val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
                val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
                when (state) {
                    TelephonyManager.EXTRA_STATE_RINGING -> {
                        isRinging = true
                        answeredThisRing = false
                        val digits = number?.filter { it.isDigit() }.orEmpty()
                        if (digits.length >= 4) {
                            lastRingPhone = digits
                            IncomingCallRouter.onRinging(app, digits)
                        }
                        // 번호 없음: Android 10+ 잠금 화면 — CallScreeningService 가 번호·CRM UI 담당
                    }
                    TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                        answeredThisRing = true
                        IncomingCallRouter.onOffHook(app)
                    }
                    TelephonyManager.EXTRA_STATE_IDLE -> {
                        val missedPhone = lastRingPhone
                        if (isRinging && !answeredThisRing && !missedPhone.isNullOrBlank()) {
                            IncomingCallRouter.onMissed(app, missedPhone)
                        }
                        if (isRinging) {
                            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                                CallLogSync.syncAfterCall(app)
                            }, 800)
                        }
                        isRinging = false
                        answeredThisRing = false
                        lastRingPhone = null
                        IncomingCallRouter.onIdle(app)
                    }
                }
            }
        }
        receiver = r
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            app.registerReceiver(r, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            app.registerReceiver(r, filter)
        }
    }

    fun stop(context: Context) {
        val r = receiver ?: return
        runCatching { context.applicationContext.unregisterReceiver(r) }
        receiver = null
        isRinging = false
        answeredThisRing = false
        lastRingPhone = null
    }

    private fun hasPhoneStatePermission(context: Context): Boolean {
        val readState = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.READ_PHONE_STATE,
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val readLog = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.READ_CALL_LOG,
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        return readState && readLog
    }
}
