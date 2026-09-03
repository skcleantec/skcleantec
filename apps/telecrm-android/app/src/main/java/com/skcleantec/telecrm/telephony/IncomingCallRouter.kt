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

    fun onRinging(context: Context, phone: String) {
        val app = context.applicationContext
        val now = System.currentTimeMillis()
        if (phone == activePhone && now - lastRingAtMs < 2500) return
        activePhone = phone
        lastRingAtMs = now
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
            if (activePhone != phone) return@launch
            IncomingCallSession.set(phone, lookup)
            TelecrmNotificationHelper.showIncomingCall(app, phone, lookup)
            IncomingCallSession.notifyUpdated()
        }
    }

    fun onOffHook(context: Context) {
        // 시스템 전화 UI로 받아도 CRM 알림은 잠시 유지(조회 결과 확인용)
    }

    fun onMissed(context: Context, phone: String) {
        val digits = phone.filter { it.isDigit() }
        if (digits.length < 4) return
        val lookup = IncomingCallSession.lookup()?.takeIf { IncomingCallSession.phone() == digits }
        TelecrmNotificationHelper.showMissedCall(context.applicationContext, digits, lookup)
    }

    fun onIdle(context: Context) {
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

    private val listeners = mutableListOf<() -> Unit>()

    fun set(phoneDigits: String, lookupJson: JSONObject?) {
        phone = phoneDigits
        lookup = lookupJson
    }

    fun phone(): String? = phone

    fun lookup(): JSONObject? = lookup

    fun clear() {
        phone = null
        lookup = null
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
