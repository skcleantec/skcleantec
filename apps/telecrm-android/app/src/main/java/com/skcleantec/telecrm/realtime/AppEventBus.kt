package com.skcleantec.telecrm.realtime

import org.json.JSONObject

/** WebSocket → UI 이벤트 버스 (MainActivity·Fragment 공유) */
object AppEventBus {
    data class ToastAlert(val title: String, val body: String)

    data class DialPrefill(
        val phone: String,
        val inquiryId: String?,
        val customerMatch: String?,
    )

    data class DispatchPayload(
        val id: String?,
        val action: String,
        val phone: String,
        val body: String?,
        val imageUrl: String?,
        val inquiryId: String?,
        val customerMatch: String?,
    )

    private val inboxRefreshListeners = linkedSetOf<() -> Unit>()
    private val connectionListeners = linkedSetOf<(Boolean) -> Unit>()
    private val toastListeners = linkedSetOf<(ToastAlert) -> Unit>()
    private val dialPrefillListeners = linkedSetOf<(DialPrefill) -> Unit>()
    private var pendingDialPrefill: DialPrefill? = null
    private val dispatchListeners = linkedSetOf<(DispatchPayload) -> Unit>()

    fun addInboxRefreshListener(listener: () -> Unit) {
        inboxRefreshListeners.add(listener)
    }

    fun removeInboxRefreshListener(listener: () -> Unit) {
        inboxRefreshListeners.remove(listener)
    }

    fun addConnectionListener(listener: (Boolean) -> Unit) {
        connectionListeners.add(listener)
    }

    fun removeConnectionListener(listener: (Boolean) -> Unit) {
        connectionListeners.remove(listener)
    }

    fun addToastListener(listener: (ToastAlert) -> Unit) {
        toastListeners.add(listener)
    }

    fun removeToastListener(listener: (ToastAlert) -> Unit) {
        toastListeners.remove(listener)
    }

    fun addDialPrefillListener(listener: (DialPrefill) -> Unit) {
        dialPrefillListeners.add(listener)
        pendingDialPrefill?.let { runCatching { listener(it) } }
    }

    fun removeDialPrefillListener(listener: (DialPrefill) -> Unit) {
        dialPrefillListeners.remove(listener)
    }

    fun addDispatchListener(listener: (DispatchPayload) -> Unit) {
        dispatchListeners.add(listener)
    }

    fun removeDispatchListener(listener: (DispatchPayload) -> Unit) {
        dispatchListeners.remove(listener)
    }

    fun emitInboxRefresh() {
        inboxRefreshListeners.forEach { runCatching { it() } }
    }

    fun emitConnection(connected: Boolean) {
        connectionListeners.forEach { runCatching { it(connected) } }
    }

    fun emitToast(title: String, body: String) {
        val alert = ToastAlert(title, body)
        toastListeners.forEach { runCatching { it(alert) } }
    }

    fun emitDialPrefill(phone: String, inquiryId: String?, customerMatch: String?) {
        val payload = DialPrefill(phone, inquiryId, customerMatch)
        pendingDialPrefill = payload
        dialPrefillListeners.forEach { runCatching { it(payload) } }
    }

    fun emitDispatch(payload: DispatchPayload) {
        dispatchListeners.forEach { runCatching { it(payload) } }
    }

    fun handlePayload(json: JSONObject) {
        when (json.optString("type")) {
            "telecrm:dispatch" -> {
                // TelecrmRealtimeService WebSocket에서 TelecrmDispatchRouter로 처리
            }
            "inbox:refresh" -> emitInboxRefresh()
            "inquiry:celebrate" -> {
                val customer = json.optString("customerName")
                val registrar = json.optString("registrarName")
                emitToast("새 접수", "$customer · $registrar")
                emitInboxRefresh()
            }
            "changelog:new" -> {
                val customer = json.optString("customerName")
                val summary = json.optString("summary")
                emitToast("접수 변동 · $customer", summary)
                emitInboxRefresh()
            }
            "review-payback:new" -> {
                val customer = json.optString("customerName")
                emitToast("페이백 신청", customer)
                emitInboxRefresh()
            }
        }
    }
}
