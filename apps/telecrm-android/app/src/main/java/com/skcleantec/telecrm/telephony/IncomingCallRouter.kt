package com.skcleantec.telecrm.telephony

import android.content.Context
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.service.TelecrmNotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

object IncomingCallRouter {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var lookupJob: Job? = null
    private var activePhone: String? = null
    private var lastRingAtMs: Long = 0
    private var ringGeneration: Long = 0
    private var incomingUiDismissed = false

    fun onRinging(context: Context, phone: String) {
        val app = context.applicationContext
        val now = System.currentTimeMillis()
        if (phone == activePhone && now - lastRingAtMs < 2500) return
        activePhone = phone
        lastRingAtMs = now
        incomingUiDismissed = false
        val generation = ++ringGeneration
        IncomingCallSession.set(phone, null)

        // 잠금 화면: startActivity 는 막히므로 full-screen 알림만 사용
        TelecrmNotificationHelper.showIncomingCall(app, phone, null)

        lookupJob?.cancel()
        lookupJob = scope.launch {
            withContext(Dispatchers.IO) {
                val token = TokenStore.get(app).getToken() ?: return@withContext
                ApiClient.fromContext(app).notifyMobileIncomingRing(token, phone)
            }
            val lookup = withContext(Dispatchers.IO) {
                val token = TokenStore.get(app).getToken() ?: return@withContext null
                ApiClient.fromContext(app).customerLookup(token, phone, null).getOrNull()
            }
            if (incomingUiDismissed || ringGeneration != generation || activePhone != phone) return@launch
            IncomingCallSession.set(phone, lookup)
            TelecrmNotificationHelper.showIncomingCall(app, phone, lookup)
            IncomingCallSession.notifyUpdated()
        }
    }

    fun onOffHook(context: Context) {
        incomingUiDismissed = true
        lookupJob?.cancel()
        IncomingCallSession.markCallTaken()
        TelecrmNotificationHelper.cancelIncomingCall(context.applicationContext)
    }

    fun onMissed(context: Context, phone: String) {
        val digits = phone.filter { it.isDigit() }
        if (digits.length < 4) return
        val lookup = IncomingCallSession.lookup()?.takeIf { IncomingCallSession.phone() == digits }
        TelecrmNotificationHelper.showMissedCall(context.applicationContext, digits, lookup)
    }

    fun onIdle(context: Context) {
        incomingUiDismissed = true
        ringGeneration++
        activePhone = null
        lookupJob?.cancel()
        lookupJob = null
        IncomingCallSession.clear()
        TelecrmNotificationHelper.cancelIncomingCall(context.applicationContext)
    }
}

object IncomingCallSession {
    @Volatile
    private var phone: String? = null

    @Volatile
    private var lookup: JSONObject? = null

    @Volatile
    private var callTaken = false

    private val listeners = mutableListOf<() -> Unit>()

    fun set(phoneDigits: String, lookupJson: JSONObject?) {
        if (callTaken && phone == phoneDigits) {
            lookup = lookupJson
            return
        }
        callTaken = false
        phone = phoneDigits
        lookup = lookupJson
    }

    fun phone(): String? = phone

    fun lookup(): JSONObject? = lookup

    fun isIncomingUiActive(): Boolean = !phone.isNullOrBlank() && !callTaken

    fun markCallTaken() {
        callTaken = true
        notifyUpdated()
    }

    fun clear() {
        phone = null
        lookup = null
        callTaken = false
        notifyUpdated()
        listeners.clear()
    }

    fun addListener(listener: () -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: () -> Unit) {
        listeners.remove(listener)
    }

    fun notifyUpdated() {
        listeners.toList().forEach { it.invoke() }
    }
}
