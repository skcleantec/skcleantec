package com.skcleantec.telecrm.telephony

import android.content.Context
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.service.TelecrmNotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
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
    private var callAnswered = false
    private val outboundUntilMs = mutableMapOf<String, Long>()

    /** 앱이 직접 건 번호 — 이 동안 수신 벨로 처리하지 않음 */
    fun rememberOutbound(rawPhone: String) {
        val phone = CallerInfo.normalizeDigits(rawPhone)
        if (phone.length < 4) return
        val now = System.currentTimeMillis()
        outboundUntilMs[phone] = now + OUTBOUND_IGNORE_MS
        outboundUntilMs.entries.removeAll { it.value < now }
    }

    private fun isRecentOutbound(phone: String): Boolean {
        val now = System.currentTimeMillis()
        var matched = false
        val iterator = outboundUntilMs.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (entry.value < now) {
                iterator.remove()
                continue
            }
            if (phonesSame(entry.key, phone)) matched = true
        }
        return matched
    }

    fun onRinging(context: Context, rawPhone: String) {
        val app = context.applicationContext
        val phone = CallerInfo.normalizeDigits(rawPhone)
        if (phone.length < 4) return
        if (isRecentOutbound(phone)) return
        val now = System.currentTimeMillis()
        if (phone == activePhone && now - lastRingAtMs < 2500) return
        activePhone = phone
        lastRingAtMs = now
        incomingUiDismissed = false
        callAnswered = false
        val generation = ++ringGeneration
        IncomingCallSession.set(phone, null)

        // 잠금 화면: startActivity 는 막히므로 full-screen 알림만 사용
        TelecrmNotificationHelper.showIncomingCall(app, phone, null)
        // 기본 전화 화면 위에 겹쳐 뜨는 고객 카드
        CallerOverlay.showRinging(app, phone, null, null)

        // PC 화면 알림은 따로 보냄 — 고객 조회가 이 요청을 기다리지 않게
        scope.launch(Dispatchers.IO) {
            val token = TokenStore.get(app).getToken() ?: return@launch
            ApiClient.fromContext(app).notifyMobileIncomingRing(token, phone)
        }

        lookupJob?.cancel()
        lookupJob = scope.launch {
            var result: Result<JSONObject> = Result.failure(IllegalStateException("고객 정보를 불러오지 못했어요."))
            for (attempt in 0 until 2) {
                result = withContext(Dispatchers.IO) {
                    val token = TokenStore.get(app).getToken()
                    if (token.isNullOrBlank()) {
                        Result.failure(IllegalStateException("앱에 다시 로그인해 주세요."))
                    } else {
                        ApiClient.fromContext(app).customerLookup(token, phone, null)
                    }
                }
                if (result.isSuccess || ringGeneration != generation) break
                delay(1200)
            }
            if (ringGeneration != generation || activePhone != phone) return@launch
            val lookup = result.getOrNull()
            if (lookup == null) {
                IncomingCallSession.setError(
                    phone,
                    result.exceptionOrNull()?.message?.takeIf { it.isNotBlank() } ?: "고객 정보를 불러오지 못했어요.",
                )
                IncomingCallSession.notifyUpdated()
                if (!incomingUiDismissed) {
                    CallerOverlay.showRinging(app, phone, null, IncomingCallSession.lookupError())
                }
                return@launch
            }
            IncomingCallSession.set(phone, lookup)
            if (!incomingUiDismissed) {
                TelecrmNotificationHelper.showIncomingCall(app, phone, lookup)
                CallerOverlay.showRinging(app, phone, lookup, null)
            } else if (callAnswered) {
                TelecrmNotificationHelper.showInCallCustomer(app, phone, lookup)
                CallerOverlay.showInCall(app, phone, lookup)
            }
            IncomingCallSession.notifyUpdated()
        }
    }

    fun onOffHook(context: Context) {
        val app = context.applicationContext
        val phone = activePhone
        incomingUiDismissed = true
        if (phone == null) return // 내가 건 전화(발신) — 수신 화면과 무관
        callAnswered = true
        IncomingCallSession.markCallTaken()
        TelecrmNotificationHelper.cancelIncomingCall(app)
        // 조회는 계속 — 받은 뒤 도착해도 「통화 중 · 고객명」 알림으로 보여 줌
        val lookup = IncomingCallSession.lookup()?.takeIf { IncomingCallSession.phone() == phone }
        if (lookup != null) TelecrmNotificationHelper.showInCallCustomer(app, phone, lookup)
        CallerOverlay.showInCall(app, phone, lookup)
    }

    fun onMissed(context: Context, rawPhone: String) {
        val digits = CallerInfo.normalizeDigits(rawPhone)
        if (digits.length < 4) return
        val lookup = IncomingCallSession.lookup()?.takeIf { IncomingCallSession.phone() == digits }
        TelecrmNotificationHelper.showMissedCall(context.applicationContext, digits, lookup)
    }

    fun onIdle(context: Context) {
        incomingUiDismissed = true
        callAnswered = false
        ringGeneration++
        activePhone = null
        lookupJob?.cancel()
        lookupJob = null
        IncomingCallSession.clear()
        TelecrmNotificationHelper.cancelIncomingCall(context.applicationContext)
        TelecrmNotificationHelper.cancelInCallCustomer(context.applicationContext)
        CallerOverlay.hide(context.applicationContext)
        if (!CallerOverlay.canShow(context.applicationContext)) {
            TelecrmNotificationHelper.showOverlayPermissionReminder(context.applicationContext)
        }
    }
}

private const val OUTBOUND_IGNORE_MS = 60_000L

private fun phonesSame(a: String, b: String): Boolean {
    if (a == b) return true
    val na = if (a.startsWith("82") && a.length > 9) "0" + a.removePrefix("82") else a
    val nb = if (b.startsWith("82") && b.length > 9) "0" + b.removePrefix("82") else b
    if (na == nb) return true
    val shorter = if (na.length <= nb.length) na else nb
    val longer = if (na.length <= nb.length) nb else na
    return shorter.length >= 8 && longer.endsWith(shorter)
}

object IncomingCallSession {
    @Volatile
    private var phone: String? = null

    @Volatile
    private var lookup: JSONObject? = null

    @Volatile
    private var callTaken = false

    @Volatile
    private var lookupError: String? = null

    private val listeners = mutableListOf<() -> Unit>()

    fun set(phoneDigits: String, lookupJson: JSONObject?) {
        lookupError = null
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

    /** 고객 조회 실패 사유 — 있으면 「조회 중」 대신 이 문구를 보여 줌 */
    fun lookupError(): String? = lookupError

    fun setError(phoneDigits: String, message: String) {
        if (phone != phoneDigits) return
        lookupError = message
    }

    fun isIncomingUiActive(): Boolean = !phone.isNullOrBlank() && !callTaken

    fun markCallTaken() {
        callTaken = true
        notifyUpdated()
    }

    fun clear() {
        phone = null
        lookup = null
        lookupError = null
        callTaken = false
        notifyUpdated()
        // 리스너는 각 화면이 닫힐 때 직접 뺀다(여기서 지우면 다음 전화 때 이름이 안 바뀜)
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
