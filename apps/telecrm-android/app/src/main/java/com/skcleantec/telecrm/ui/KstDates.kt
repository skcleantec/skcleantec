package com.skcleantec.telecrm.ui

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object KstDates {
    fun todayYmd(): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("Asia/Seoul")
        return fmt.format(Date())
    }

    fun formatDuration(totalSec: Int): String {
        if (totalSec <= 0) return "0초"
        val m = totalSec / 60
        val s = totalSec % 60
        return if (m > 0) "${m}분 ${s}초" else "${s}초"
    }

    fun matchLabel(key: String): String = when (key) {
        "new" -> "신규"
        "existing" -> "기존"
        "pick" -> "선택"
        "unknown" -> "미분류"
        else -> key
    }
}
