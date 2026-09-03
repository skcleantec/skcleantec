package com.skcleantec.telecrm.ui

enum class StatusBadgeTone(val fgRes: Int, val bgRes: Int) {
    SUCCESS(com.skcleantec.telecrm.R.color.emerald_600, com.skcleantec.telecrm.R.drawable.bg_badge_emerald),
    WARN(com.skcleantec.telecrm.R.color.amber_500, com.skcleantec.telecrm.R.drawable.bg_badge_amber),
    DANGER(com.skcleantec.telecrm.R.color.rose_500, com.skcleantec.telecrm.R.drawable.bg_badge_rose),
    INFO(com.skcleantec.telecrm.R.color.blue_600, com.skcleantec.telecrm.R.drawable.bg_badge_blue),
    NEUTRAL(com.skcleantec.telecrm.R.color.slate_600, com.skcleantec.telecrm.R.drawable.bg_badge_slate),
}

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

    fun statusTone(code: String?): StatusBadgeTone = when (code?.trim()) {
        "RECEIVED", "ASSIGNED", "IN_PROGRESS", "COMPLETED" -> StatusBadgeTone.SUCCESS
        "DEPOSIT_PENDING", "DEPOSIT_COMPLETED", "ORDER_FORM_PENDING", "PENDING" -> StatusBadgeTone.WARN
        "CANCELLED", "ON_HOLD" -> StatusBadgeTone.DANGER
        else -> StatusBadgeTone.NEUTRAL
    }

    fun matchLabel(match: String?): String = when (match) {
        "existing" -> "기존 고객"
        "new" -> "신규 고객"
        "pick" -> "동명이인 선택"
        else -> match?.takeIf { it.isNotBlank() } ?: "-"
    }
}
