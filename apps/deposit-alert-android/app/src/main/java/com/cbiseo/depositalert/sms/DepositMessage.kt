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

/** 입금+농협만 통과. 출금·결제·광고는 기기 밖으로 내보내지 않는다. */
fun shouldForwardDeposit(text: String): Boolean {
    if (text.contains("출금") || text.contains("결제") || text.contains("광고")) return false
    return text.contains("입금") && text.contains("농협")
}

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

fun dedupeKey(sender: String, strippedText: String, receivedAtMillis: Long): String {
    val material = sender.trim() + "\n" + strippedText.trim() + "\n" + receivedMinuteKey(receivedAtMillis)
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
    val forward = shouldForwardDeposit(rawText)
    val stripped = if (forward) stripBalance(rawText) else ""
    val safe = forward && stripped.isNotEmpty() && balanceRemoved(stripped)
    val (amount, name) = if (safe) displayFields(stripped) else "" to ""
    return DepositPreview(
        forward = safe,
        stripped = if (safe) stripped else "",
        amountLabel = amount,
        depositorName = name,
        dedupeKey = if (safe) dedupeKey(sender, stripped, receivedAtMillis) else "",
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
    else -> "보냄"
}
