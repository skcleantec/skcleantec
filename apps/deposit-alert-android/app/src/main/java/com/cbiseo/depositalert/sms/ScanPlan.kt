package com.cbiseo.depositalert.sms

const val SCAN_WINDOW_MS = 48L * 60 * 60 * 1000

data class InboxLine(val sender: String, val body: String, val receivedAtMillis: Long)

data class ScanChoice(
    val scanned: Int,
    val picks: List<InboxLine>,
    val drops: Map<DropReason, Int>,
)

/** 최근 48시간 안에서 농협 입금만 고른다. 이미 보낸 contentHash 는 빼다. */
fun chooseScan(
    lines: List<InboxLine>,
    already: Set<String>,
    nowMillis: Long,
    windowMs: Long = SCAN_WINDOW_MS,
): ScanChoice {
    val drops = linkedMapOf<DropReason, Int>()
    val picks = mutableListOf<InboxLine>()
    val seen = HashSet(already)
    var scanned = 0
    for (line in lines) {
        if (line.receivedAtMillis <= 0L) continue
        val age = nowMillis - line.receivedAtMillis
        if (age < 0L || age > windowMs) continue
        scanned++
        val reason = dropReason(line.body)
        if (reason != null) {
            drops[reason] = (drops[reason] ?: 0) + 1
            continue
        }
        val hash = contentHash(line.sender, line.body)
        if (!seen.add(hash)) continue
        picks.add(line)
    }
    return ScanChoice(scanned, picks, drops)
}

/** 본문이 입금이면 본문만 쓴다. 제목에만 내용이 있을 때만 제목을 쓴다. */
fun mmsScanText(subject: String, parts: List<String>): String {
    val body = parts.map { it.trim() }.filter { it.isNotEmpty() }.joinToString("\n")
    if (body.isNotEmpty() && dropReason(body) == null) return body
    val title = subject.trim()
    val joined = listOf(title, body).filter { it.isNotEmpty() }.joinToString("\n")
    if (joined.isNotEmpty() && dropReason(joined) == null) return joined
    return body.ifEmpty { title }
}

/** 멀티미디어 문자 시각은 초인 폰과 밀리초인 폰이 있다. */
fun mmsDateMillis(raw: Long): Long {
    if (raw <= 0L) return 0L
    return if (raw < 10_000_000_000L) raw * 1000 else raw
}
