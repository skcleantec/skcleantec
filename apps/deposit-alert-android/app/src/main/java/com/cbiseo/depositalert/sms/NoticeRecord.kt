package com.cbiseo.depositalert.sms

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

enum class NoticeFate { Send, AlreadySent, NotDeposit }

/**
 * 사라진 알림도 다시 받는다.
 * 이미 보낸 해시이거나 다른 경로가 먼저 받았으면 다시 보내지 않는다.
 */
fun fateOfRemovedNotice(isDeposit: Boolean, hashAlreadySent: Boolean, otherPathAlready: Boolean): NoticeFate {
    if (!isDeposit) return NoticeFate.NotDeposit
    if (hashAlreadySent || otherPathAlready) return NoticeFate.AlreadySent
    return NoticeFate.Send
}

enum class IntakeOutcome { Queued, Duplicate, NotDeposit }

enum class NoticeRecordResult { Sent, AlreadySent, NotDeposit, Unread }

fun classifyNoticeRecord(
    lineCount: Int,
    outcomes: List<IntakeOutcome>,
    missedBank: Boolean,
): NoticeRecordResult {
    if (outcomes.any { it == IntakeOutcome.Queued }) return NoticeRecordResult.Sent
    if (outcomes.any { it == IntakeOutcome.Duplicate }) return NoticeRecordResult.AlreadySent
    if (lineCount <= 0 || missedBank) return NoticeRecordResult.Unread
    return NoticeRecordResult.NotDeposit
}

fun noticeResultLabel(result: NoticeRecordResult): String = when (result) {
    NoticeRecordResult.Sent -> "보냄"
    NoticeRecordResult.AlreadySent -> "이미 보냄"
    NoticeRecordResult.NotDeposit -> "입금 아님"
    NoticeRecordResult.Unread -> "읽지 못함"
}

fun noticeResultCode(result: NoticeRecordResult): String = when (result) {
    NoticeRecordResult.Sent -> "sent"
    NoticeRecordResult.AlreadySent -> "dup"
    NoticeRecordResult.NotDeposit -> "not"
    NoticeRecordResult.Unread -> "unread"
}

fun noticeResultFromCode(code: String): NoticeRecordResult? = when (code) {
    "sent" -> NoticeRecordResult.Sent
    "dup" -> NoticeRecordResult.AlreadySent
    "not" -> NoticeRecordResult.NotDeposit
    "unread" -> NoticeRecordResult.Unread
    else -> null
}

data class NoticeRecord(val atMillis: Long, val lines: Int, val result: NoticeRecordResult)

fun trimNoticeLog(rows: List<NoticeRecord>): List<NoticeRecord> = rows.takeLast(20)

private val CLOCK = DateTimeFormatter.ofPattern("HH:mm")

fun formatNoticeLine(record: NoticeRecord, zone: ZoneId): String {
    val time = Instant.ofEpochMilli(record.atMillis).atZone(zone).format(CLOCK)
    return "$time · ${record.lines}줄 · ${noticeResultLabel(record.result)}"
}
