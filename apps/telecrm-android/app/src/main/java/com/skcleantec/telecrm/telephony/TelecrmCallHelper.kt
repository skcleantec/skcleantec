package com.skcleantec.telecrm.telephony

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import com.skcleantec.telecrm.api.ApiClient
import org.json.JSONObject

object TelecrmCallHelper {
    fun dial(context: Context, phone: String) {
        val digits = phone.filter { it.isDigit() }
        if (digits.length < 4) {
            Toast.makeText(context, "전화번호(4자 이상)를 입력해 주세요.", Toast.LENGTH_SHORT).show()
            return
        }
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun openSms(context: Context, phone: String, body: String = "") {
        val digits = phone.filter { it.isDigit() }
        if (digits.isEmpty()) {
            Toast.makeText(context, "전화번호를 입력해 주세요.", Toast.LENGTH_SHORT).show()
            return
        }
        val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$digits"))
        if (body.isNotBlank()) intent.putExtra("sms_body", body)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun logCall(
        context: Context,
        apiClient: ApiClient,
        token: String,
        phone: String,
        direction: String,
        inquiryId: String?,
        customerMatch: String?,
        durationSec: Int? = null,
    ) {
        Thread {
            val payload = JSONObject()
                .put("phone", phone.filter { it.isDigit() })
                .put("direction", direction)
                .put("customerMatch", customerMatch?.takeIf { it.isNotBlank() } ?: "unknown")
            if (!inquiryId.isNullOrBlank()) payload.put("inquiryId", inquiryId)
            if (durationSec != null && durationSec > 0) payload.put("durationSec", durationSec)
            apiClient.postCallSession(token, payload).onFailure {
                android.os.Handler(context.mainLooper).post {
                    Toast.makeText(context, "통화 기록 저장 실패", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }

    fun logOutboundCall(
        context: Context,
        apiClient: ApiClient,
        token: String,
        phone: String,
        inquiryId: String?,
        customerMatch: String?,
    ) = logCall(context, apiClient, token, phone, "OUTBOUND", inquiryId, customerMatch)
}
