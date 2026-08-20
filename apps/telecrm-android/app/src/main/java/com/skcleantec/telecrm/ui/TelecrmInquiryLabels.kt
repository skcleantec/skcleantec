package com.skcleantec.telecrm.ui

object TelecrmInquiryLabels {
    private val STATUS = mapOf(
        "PENDING" to "대기",
        "RECEIVED" to "예약완료",
        "DEPOSIT_PENDING" to "입금대기",
        "DEPOSIT_COMPLETED" to "입금완료",
        "ORDER_FORM_PENDING" to "미제출",
        "ASSIGNED" to "분배완료",
        "IN_PROGRESS" to "진행중",
        "COMPLETED" to "완료",
        "ON_HOLD" to "보류",
        "CANCELLED" to "취소",
    )

    fun statusLabel(code: String?): String {
        val key = code?.trim().orEmpty()
        if (key.isEmpty()) return "-"
        return STATUS[key] ?: key
    }

    fun matchLabel(match: String?): String = when (match) {
        "existing" -> "기존 고객"
        "new" -> "신규 고객"
        "pick" -> "동명이인 선택"
        else -> match?.takeIf { it.isNotBlank() } ?: "-"
    }
}
