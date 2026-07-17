package com.skcleantec.telecrm.telephony

import android.app.Activity
import android.content.Intent
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import com.skcleantec.telecrm.main.MainActivity
import java.lang.ref.WeakReference

/** 통화 앱에서 돌아올 때 CRM 앱을 다시 앞으로 가져옵니다 (기본 전화앱 불필요). */
object CallReturnMonitor {
    private var telephonyManager: TelephonyManager? = null
    @Suppress("DEPRECATION")
    private var listener: PhoneStateListener? = null
    private var wasOffHook = false
    private var activityRef: WeakReference<Activity>? = null

    @Suppress("DEPRECATION")
    fun watch(activity: Activity) {
        unwatch()
        activityRef = WeakReference(activity)
        wasOffHook = false
        val tm = activity.getSystemService(TelephonyManager::class.java)
        telephonyManager = tm
        val l = object : PhoneStateListener() {
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                when (state) {
                    TelephonyManager.CALL_STATE_OFFHOOK -> wasOffHook = true
                    TelephonyManager.CALL_STATE_IDLE -> {
                        if (wasOffHook) {
                            val ctx = activityRef?.get()?.applicationContext
                            if (ctx != null) {
                                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                                    CallLogSync.syncAfterCall(ctx)
                                }, 800)
                            }
                            bringMainToFront()
                        }
                        unwatch()
                    }
                }
            }
        }
        listener = l
        tm.listen(l, PhoneStateListener.LISTEN_CALL_STATE)
    }

    private fun bringMainToFront() {
        val act = activityRef?.get() ?: return
        val intent = Intent(act, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        act.startActivity(intent)
    }

    @Suppress("DEPRECATION")
    fun unwatch() {
        listener?.let { telephonyManager?.listen(it, PhoneStateListener.LISTEN_NONE) }
        listener = null
        telephonyManager = null
        activityRef = null
        wasOffHook = false
    }
}
