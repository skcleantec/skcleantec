package com.skcleantec.telecrm.service

import android.content.Context
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.dispatch.TelecrmDispatchDeduper
import com.skcleantec.telecrm.dispatch.TelecrmDispatchPayload
import com.skcleantec.telecrm.realtime.AppEventBus

/** PC→폰 dispatch 라우팅 — 포그라운드는 MainActivity, 백그라운드는 알림·full-screen */
object TelecrmDispatchRouter {
    fun fromJson(json: org.json.JSONObject): AppEventBus.DispatchPayload =
        AppEventBus.DispatchPayload(
            id = json.optString("id").takeIf { it.isNotBlank() },
            action = json.optString("action", "call"),
            phone = json.optString("phone"),
            body = json.optString("body").takeIf { it.isNotBlank() },
            imageUrl = json.optString("imageUrl").takeIf { it.isNotBlank() },
            inquiryId = json.optString("inquiryId").takeIf { it.isNotBlank() },
            customerMatch = json.optString("customerMatch").takeIf { it.isNotBlank() },
            targetUserId = json.optString("targetUserId").takeIf { it.isNotBlank() },
            broadcastToTenant = json.optBoolean("broadcastToTenant", false),
        )

    /** 본인 targetUserId만 수신 — 불명확하면 거부 (fail-closed) */
    private fun shouldAcceptDispatch(context: Context, payload: AppEventBus.DispatchPayload): Boolean {
        if (payload.broadcastToTenant) return false
        val target = payload.targetUserId?.takeIf { it.isNotBlank() } ?: return false
        val myId = TokenStore.get(context).resolveUserId()?.takeIf { it.isNotBlank() } ?: return false
        return target == myId
    }

    fun route(context: Context, payload: AppEventBus.DispatchPayload) {
        if (!shouldAcceptDispatch(context, payload)) return
        val item = TelecrmDispatchPayload(
            id = payload.id,
            action = payload.action,
            phone = payload.phone,
            body = payload.body,
            imageUrl = payload.imageUrl,
            inquiryId = payload.inquiryId,
            customerMatch = payload.customerMatch,
        )
        if (!TelecrmDispatchDeduper.shouldRun(item.id)) return

        if (TelecrmAppState.isMainInForeground) {
            AppEventBus.emitDispatch(payload)
            return
        }

        when (item.action) {
            "call" -> TelecrmNotificationHelper.showCallDispatch(context, item)
            "sms" -> TelecrmNotificationHelper.showSmsDispatch(context, item)
            "prefill" -> TelecrmNotificationHelper.showCallDispatch(context, item)
            else -> TelecrmNotificationHelper.showCallDispatch(context, item)
        }
    }
}
