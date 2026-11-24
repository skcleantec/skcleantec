package com.cbiseo.depositalert.sms

import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** 농협 입금 문자만 기기에 남기고, 잔액은 서버로 나가지 않게 다듬는다. */

val SAMPLE_NH_SMS = """
[Web발신]
-농협 입금20,000원
11/24 09:04 301-****-9047-01 김명희 잔액4,041,585원
""".trim()

private val BALANCE = Regex("잔액\\s*[:：]?\\s*[0-9][0-9,]*\\s*원")
private val AMOUNT = Regex("입금\\s*([0-9][0-9,]*)\\s*원")
private val NAME = Regex("""\d{1,2}/\d{1,2}\s+\d{1,2}:\d{2}\s+\S+\s+(\S+)""")
private val SEOUL = ZoneId.of("Asia/Seoul")
private val MINUTE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
private val ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME

fun joinSmsParts(parts: List<String>): String = parts.joinToString(separator = "") { it }

enum class DropReason { NoBank, NoDeposit, Blocked, BalanceLeft }

private val WITHDRAWAL = "농협 출금"

/** 농협 입금과 금액 꼴이 있으면 입금이다. 이름 자리의 출금·결제·광고는 보지 않는다. */
fun isDepositShape(text: String): Boolean {
    return text.contains("농협") && AMOUNT.containsMatchIn(text) && !isWithdrawalLead(text)
}

/** 앞머리가 농협 출금인 조각. [Web발신]과 붙임표만 허용한다. */
fun isWithdrawalLead(text: String): Boolean {
    var body = text.trim()
    while (body.startsWith("[Web발신]")) body = body.removePrefix("[Web발신]").trim()
    body = body.trimStart { it.isWhitespace() || it == '-' }
    return body.startsWith(WITHDRAWAL)
}

/**
 * 입금이 아니면 탈락 이유. 통과면 null.
 * 농협 입금+금액이면 통과한다. 농협 출금으로 시작하거나, 금액 꼴이 없거나, 농협이 아니면 버린다.
 */
fun dropReason(text: String): DropReason? {
    if (isWithdrawalLead(text)) return DropReason.Blocked
    if (!text.contains("농협")) return DropReason.NoBank
    if (!isDepositShape(text)) return DropReason.NoDeposit
    val stripped = stripBalance(text)
    if (stripped.isEmpty() || !balanceRemoved(stripped)) return DropReason.BalanceLeft
    return null
}

/** 한 글에 입금과 출금이 같이 있으면 나눈 뒤, 입금 조각만 돌려준다. */
fun depositSlices(text: String): List<String> {
    return splitBankBlob(text).filter { dropReason(it) == null }
}

/** 입금 조각이 하나라도 있으면 참. 출금 조각은 나가지 않는다. */
fun shouldForwardDeposit(text: String): Boolean = depositSlices(text).isNotEmpty()

fun stripBalance(text: String): String {
    return BALANCE.replace(text, " ")
        .replace(Regex("[ \\t]{2,}"), " ")
        .replace(Regex(" *\\n *"), "\n")
        .trim()
}

fun balanceRemoved(text: String): Boolean = !text.contains("잔액")

fun receivedMinuteKey(receivedAtMillis: Long): String {
    return Instant.ofEpochMilli(receivedAtMillis).atZone(SEOUL).format(MINUTE)
}

fun receivedAtIso(receivedAtMillis: Long): String {
    return Instant.ofEpochMilli(receivedAtMillis).atZone(SEOUL).format(ISO)
}

/** 보낸이와 잔액이 들어 있는 원문만 해시한다. 받은 시각은 넣지 않는다. */
fun contentHash(sender: String, rawText: String): String {
    return sha256(sender.trim() + "\n" + rawText)
}

fun sourceLabel(source: IntakeSource): String = when (source) {
    IntakeSource.Sms -> "sms"
    IntakeSource.Notice, IntakeSource.NoticeRescan -> "notification"
    IntakeSource.Scan -> "scan"
}

/** 키에만 원문을 쓴다. 해시를 만든 뒤 원문은 저장하지 않는다. */
fun dedupeKey(sender: String, rawText: String, receivedAtMillis: Long): String {
    val material = sender.trim() + "\n" + rawText + "\n" + receivedMinuteKey(receivedAtMillis)
    return sha256(material)
}

/** 문자 방송과 메시지 알림이 같은 입금을 두 번 보내지 않게, 잔액을 지운 본문과 분만 해시한다. */
fun crossPathKey(rawText: String, receivedAtMillis: Long): String {
    return sha256(stripBalance(rawText) + "\n" + receivedMinuteKey(receivedAtMillis))
}

private fun sha256(material: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(material.toByteArray(Charsets.UTF_8))
    return digest.joinToString(separator = "") { byte -> "%02x".format(byte) }
}

data class DepositPreview(
    val forward: Boolean,
    val stripped: String,
    val amountLabel: String,
    val depositorName: String,
    val dedupeKey: String,
)

fun previewDeposit(sender: String, rawText: String, receivedAtMillis: Long): DepositPreview {
    val slice = depositSlices(rawText).firstOrNull().orEmpty()
    val forward = slice.isNotEmpty()
    val stripped = if (forward) stripBalance(slice) else ""
    val safe = forward && stripped.isNotEmpty() && balanceRemoved(stripped)
    val (amount, name) = if (safe) displayFields(stripped) else "" to ""
    return DepositPreview(
        forward = safe,
        stripped = if (safe) stripped else "",
        amountLabel = amount,
        depositorName = name,
        dedupeKey = if (safe) dedupeKey(sender, slice, receivedAtMillis) else "",
    )
}

fun displayFields(stripped: String): Pair<String, String> {
    val amount = AMOUNT.find(stripped)?.groupValues?.get(1)?.let { "${it}원" }.orEmpty()
    val name = NAME.find(stripped)?.groupValues?.get(1)?.trim().orEmpty()
    val safeName = if (name.isEmpty() || name.contains("잔액")) "" else name
    return amount to safeName
}

fun resultLabel(serverResult: String): String = when (serverResult) {
    "duplicate" -> "중복"
    "skipped" -> "건너뜀"
    "unsent" -> "보내지 못함"
    else -> "보냄"
}
