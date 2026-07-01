package com.skcleantec.telecrm.dispatch

import org.json.JSONObject

data class TelecrmDispatchPayload(
    val id: String?,
    val action: String,
    val phone: String,
    val body: String?,
    val imageUrl: String?,
    val inquiryId: String?,
    val customerMatch: String?,
) {
    companion object {
        fun fromJson(json: JSONObject): TelecrmDispatchPayload =
            TelecrmDispatchPayload(
                id = json.optString("id").takeIf { it.isNotBlank() },
                action = json.optString("action", "call"),
                phone = json.optString("phone"),
                body = json.optString("body").takeIf { it.isNotBlank() },
                imageUrl = json.optString("imageUrl").takeIf { it.isNotBlank() },
                inquiryId = json.optString("inquiryId").takeIf { it.isNotBlank() },
                customerMatch = json.optString("customerMatch").takeIf { it.isNotBlank() },
            )
    }
}
