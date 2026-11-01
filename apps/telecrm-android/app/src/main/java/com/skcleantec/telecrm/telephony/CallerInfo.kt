package com.skcleantec.telecrm.telephony

import com.skcleantec.telecrm.ui.TelecrmInquiryLabels
import org.json.JSONObject

/** 수신 번호·고객명 표시 공통 — 서버의 빈 값(null)이 화면에 글자로 찍히지 않게 한다 */
object CallerInfo {
    /** 숫자만 + 국가번호(82) → 0 (예: +82 10-1234-5678 → 01012345678) */
    fun normalizeDigits(raw: String?): String {
        val digits = raw?.filter { it.isDigit() }.orEmpty()
        if (digits.startsWith("82") && digits.length >= 11) return "0" + digits.substring(2)
        return digits
    }

    private fun JSONObject.text(key: String): String? {
        if (!has(key) || isNull(key)) return null
        return optString(key).trim().takeIf { it.isNotEmpty() && it != "null" }
    }

    fun latestInquiry(lookup: JSONObject?): JSONObject? =
        lookup?.optJSONArray("inquiries")?.optJSONObject(0)

    /** 다른 브랜드에만 기록이 있는 고객이면 브랜드 이름 */
    fun otherBrandName(lookup: JSONObject?): String? {
        val brand = lookup?.optJSONObject("otherBrand") ?: return null
        return brand.text("name")
    }

    /** 고객 이름 (다른 브랜드 고객이면 「이름 (브랜드)」) — 모르면 null */
    fun displayName(lookup: JSONObject?): String? {
        if (lookup == null) return null
        val name = latestInquiry(lookup)?.text("customerName")
            ?: lookup.optJSONObject("customer")?.text("name")
            ?: return null
        val brand = otherBrandName(lookup)
        return if (brand != null && latestInquiry(lookup) == null) "$name ($brand)" else name
    }

    /** 「김민수 · 예약완료」 / 「김민수 (타나클린) · 다른 브랜드 고객」 — 이름을 모르면 null */
    fun title(lookup: JSONObject?): String? {
        val name = displayName(lookup) ?: return null
        val inq = latestInquiry(lookup)
        val tail = when {
            inq != null -> TelecrmInquiryLabels.statusLabel(inq.optString("status"))
            otherBrandName(lookup) != null -> "다른 브랜드 고객"
            else -> TelecrmInquiryLabels.matchLabel(lookup?.optString("match"))
        }
        return "$name · $tail"
    }
}
