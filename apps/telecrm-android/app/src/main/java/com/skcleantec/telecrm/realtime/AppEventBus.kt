package com.skcleantec.telecrm.realtime

import org.json.JSONObject

/** WebSocket → UI 이벤트 버스 (MainActivity·Fragment 공유) */
object AppEventBus {
    data class ToastAlert(val title: String, val body: String)

    private val inboxRefreshListeners = linkedSetOf<() -> Unit>()
    private val connectionListeners = linkedSetOf<(Boolean) -> Unit>()
    private val toastListeners = linkedSetOf<(ToastAlert) -> Unit>()

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

    fun handlePayload(json: JSONObject) {
        when (json.optString("type")) {
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
