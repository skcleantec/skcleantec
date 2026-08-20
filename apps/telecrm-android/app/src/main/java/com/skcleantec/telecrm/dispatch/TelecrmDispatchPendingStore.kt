package com.skcleantec.telecrm.dispatch

import android.content.Context
import androidx.core.content.edit
import org.json.JSONObject

/** WS·알림 탭 실패·프로세스 종료 대비 — 최근 PC dispatch TTL 보관 */
object TelecrmDispatchPendingStore {
    private const val PREFS = "telecrm_dispatch_pending"
    private const val KEY_JSON = "pending_json"
    private const val KEY_SAVED_AT = "saved_at_ms"
    private const val TTL_MS = 5 * 60 * 1000L

    fun save(context: Context, payload: TelecrmDispatchPayload) {
        val digits = payload.phone.filter { it.isDigit() }
        if (digits.length < 4) return
        val json = JSONObject()
            .put("id", payload.id)
            .put("action", payload.action)
            .put("phone", digits)
            .put("body", payload.body)
            .put("imageUrl", payload.imageUrl)
            .put("inquiryId", payload.inquiryId)
            .put("customerMatch", payload.customerMatch)
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit {
                putString(KEY_JSON, json.toString())
                putLong(KEY_SAVED_AT, System.currentTimeMillis())
            }
    }

    fun consume(context: Context): TelecrmDispatchPayload? {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_JSON, null) ?: return null
        val savedAt = prefs.getLong(KEY_SAVED_AT, 0L)
        if (savedAt <= 0L || System.currentTimeMillis() - savedAt > TTL_MS) {
            discard(context)
            return null
        }
        discard(context)
        return runCatching { TelecrmDispatchPayload.fromJson(JSONObject(raw)) }.getOrNull()
    }

    fun discard(context: Context) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit {
            remove(KEY_JSON)
            remove(KEY_SAVED_AT)
        }
    }
}
