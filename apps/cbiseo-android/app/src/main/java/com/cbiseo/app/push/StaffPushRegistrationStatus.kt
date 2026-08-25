package com.cbiseo.app.push

import org.json.JSONObject
import java.util.concurrent.atomic.AtomicReference

/** JS 브릿지 `getPushRegisterStatus()` — WebView CustomEvent 대신 폴링 */
object StaffPushRegistrationStatus {
    data class Snapshot(
        val pending: Boolean = false,
        val ok: Boolean = false,
        val message: String = "",
        val fcmToken: String? = null,
        val updatedAtMs: Long = System.currentTimeMillis(),
    )

    private val current = AtomicReference(Snapshot())

    fun setPending(message: String = "등록 중…") {
        current.set(Snapshot(pending = true, ok = false, message = message))
    }

    fun setSuccess(message: String = "서버 등록 완료", fcmToken: String? = null) {
        current.set(Snapshot(pending = false, ok = true, message = message, fcmToken = fcmToken))
    }

    fun setFailure(message: String, fcmToken: String? = null) {
        current.set(Snapshot(pending = false, ok = false, message = message, fcmToken = fcmToken))
    }

    fun toJson(): String {
        val snap = current.get()
        return JSONObject()
            .put("pending", snap.pending)
            .put("ok", snap.ok)
            .put("message", snap.message)
            .put("fcmToken", snap.fcmToken ?: JSONObject.NULL)
            .put("updatedAtMs", snap.updatedAtMs)
            .toString()
    }
}
