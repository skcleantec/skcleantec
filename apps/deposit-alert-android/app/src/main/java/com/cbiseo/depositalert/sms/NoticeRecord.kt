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

enum class IntakeOutcome { Queued, Duplicate, OtherPath, NotDeposit }

enum class NoticeRecordResult { Sent, AlreadySent, NotDeposit, Unread }

data class NoticeTally(
    var sent: Int = 0,
    var alreadySent: Int = 0,
    var otherPath: Int = 0,
    var withdrawal: Int = 0,
    var noAmount: Int = 0,
    var notNh: Int = 0,
    var noText: Int = 0,
    var balance: Int = 0,
    var hiddenLost: Int = 0,
)

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

data class NoticeRecord(
    val atMillis: Long,
    val methods: String,
    val pieces: Int,
    val nhPieces: Int,
    val depositShape: Int,
    val tally: NoticeTally,
    val locked: Boolean,
    val summary: Boolean,
    val maybeHidden: Boolean = false,
)

fun trimNoticeLog(rows: List<NoticeRecord>): List<NoticeRecord> = rows.takeLast(20)

fun encodeNoticeRecord(record: NoticeRecord): String {
    val methods = record.methods.filter { it == 'a' || it == 'b' || it == 'c' || it == 'd' }
    val tally = record.tally
    return listOf(
        record.atMillis.toString(),
        methods,
        record.pieces.coerceAtLeast(0).toString(),
        record.nhPieces.coerceAtLeast(0).toString(),
        record.depositShape.coerceAtLeast(0).toString(),
        tally.sent.coerceAtLeast(0).toString(),
        tally.alreadySent.coerceAtLeast(0).toString(),
        tally.otherPath.coerceAtLeast(0).toString(),
        tally.withdrawal.coerceAtLeast(0).toString(),
        tally.noAmount.coerceAtLeast(0).toString(),
        tally.notNh.coerceAtLeast(0).toString(),
        tally.noText.coerceAtLeast(0).toString(),
        tally.balance.coerceAtLeast(0).toString(),
        if (record.locked) "1" else "0",
        if (record.summary) "1" else "0",
        if (record.maybeHidden) "1" else "0",
        tally.hiddenLost.coerceAtLeast(0).toString(),
    ).joinToString("|")
}

fun decodeNoticeRecord(line: String): NoticeRecord? {
    val part = line.split('|')
    if (part.size != 15 && part.size != 17) return null
    if (!part[1].all { it == 'a' || it == 'b' || it == 'c' || it == 'd' }) return null
    val numbers = ArrayList<Int>(13)
    val at = part[0].toLongOrNull() ?: return null
    if (at <= 0L) return null
    for (index in 2..12) {
        val value = part[index].toIntOrNull() ?: return null
        if (value < 0) return null
        numbers.add(value)
    }
    val locked = when (part[13]) {
        "1" -> true
        "0" -> false
        else -> return null
    }
    val summary = when (part[14]) {
        "1" -> true
        "0" -> false
        else -> return null
    }
    val maybeHidden = if (part.size == 15) {
        false
    } else {
        when (part[15]) {
            "1" -> true
            "0" -> false
            else -> return null
        }
    }
    val hiddenLost = if (part.size == 15) {
        0
    } else {
        val value = part[16].toIntOrNull() ?: return null
        if (value < 0) return null
        value
    }
    return NoticeRecord(
        atMillis = at,
        methods = part[1],
        pieces = numbers[0],
        nhPieces = numbers[1],
        depositShape = numbers[2],
        tally = NoticeTally(
            sent = numbers[3],
            alreadySent = numbers[4],
            otherPath = numbers[5],
            withdrawal = numbers[6],
            noAmount = numbers[7],
            notNh = numbers[8],
            noText = numbers[9],
            balance = numbers[10],
            hiddenLost = hiddenLost,
        ),
        locked = locked,
        summary = summary,
        maybeHidden = maybeHidden,
    )
}

private val CLOCK = DateTimeFormatter.ofPattern("HH:mm")

fun formatNoticeLine(record: NoticeRecord, zone: ZoneId): String {
    val time = Instant.ofEpochMilli(record.atMillis).atZone(zone).format(CLOCK)
    if (record.tally.hiddenLost > 0) return "$time · 가려진 알림이 본문 없이 사라짐"
    val tally = record.tally
    val reasons = ArrayList<String>()
    if (tally.sent > 0) reasons.add("보냄${tally.sent}")
    if (tally.alreadySent > 0) reasons.add("이미보냄${tally.alreadySent}")
    if (tally.otherPath > 0) reasons.add("다른길${tally.otherPath}")
    if (tally.withdrawal > 0) reasons.add("출금${tally.withdrawal}")
    if (tally.noAmount > 0) reasons.add("금액없음${tally.noAmount}")
    if (tally.notNh > 0) reasons.add("농협아님${tally.notNh}")
    if (tally.noText > 0) reasons.add("글없음${tally.noText}")
    if (tally.balance > 0) reasons.add("잔액${tally.balance}")
    val why = if (reasons.isEmpty()) "이유없음" else reasons.joinToString(" ")
    val lock = if (record.locked) "잠금" else "화면켜짐"
    val kind = if (record.summary) "요약" else "일반"
    val methods = record.methods.ifEmpty { "-" }
    val hidden = if (record.maybeHidden) " · 가려졌을 수 있음" else ""
    return "$time · $methods · ${record.pieces}조각 · 농협${record.nhPieces} · 입금꼴${record.depositShape} · $why · $lock · $kind$hidden"
}
