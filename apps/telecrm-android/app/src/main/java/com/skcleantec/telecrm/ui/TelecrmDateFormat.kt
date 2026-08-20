package com.skcleantec.telecrm.ui

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object TelecrmDateFormat {
    private val kst = ZoneId.of("Asia/Seoul")
    private val dateTime = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm")
    private val dateOnly = DateTimeFormatter.ofPattern("yyyy.MM.dd")

    fun dateTime(iso: String?): String {
        if (iso.isNullOrBlank()) return ""
        return runCatching {
            Instant.parse(iso).atZone(kst).format(dateTime)
        }.getOrElse {
            iso.take(16).replace('T', ' ')
        }
    }

    fun dateOnly(iso: String?): String {
        if (iso.isNullOrBlank()) return ""
        return runCatching {
            Instant.parse(iso).atZone(kst).format(dateOnly)
        }.getOrElse {
            iso.take(10)
        }
    }
}
