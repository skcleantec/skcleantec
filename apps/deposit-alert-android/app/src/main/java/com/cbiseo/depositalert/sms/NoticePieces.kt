package com.cbiseo.depositalert.sms

enum class NoticeMethod { A, B, C, D }

data class NoticeLine(val sender: String, val text: String, val timestampMillis: Long)

/** 알림에서 꺼낸 원문. 본문은 걸러내기 전에만 잠시 들고 있는다. */
data class NoticePiece(
    val sender: String,
    val text: String,
    val receivedAtMillis: Long,
    val summary: Boolean,
    val method: NoticeMethod,
)

data class NoticeDraft(
    val packageName: String,
    val summary: Boolean,
    val title: String,
    val whenMillis: Long,
    val messaging: List<NoticeLine> = emptyList(),
    val historic: List<NoticeLine> = emptyList(),
    val bundles: List<NoticeLine> = emptyList(),
    val lines: List<String> = emptyList(),
    val bigText: String? = null,
    val text: String? = null,
)

private val BANK_MARK = Regex("농협 입금|농협 출금")

/** 농협 입금·출금이 한 글에 여러 번 붙어 있으면 시작점마다 나눈다. */
fun splitBankBlob(text: String): List<String> {
    val marks = BANK_MARK.findAll(text).map { it.range.first }.toList()
    if (marks.size < 2) return listOf(text)
    return marks.mapIndexed { index, start ->
        val end = if (index + 1 < marks.size) marks[index + 1] else text.length
        text.substring(start, end).trim()
    }.filter { it.isNotEmpty() }
}

/**
 * 메시지 앱 알림에서 글을 모두 모은다.
 * a 대화 목록, b 묶음 배열, c 여러 줄, d 큰 글·짧은 글 순으로 담고, 같은 글은 한 번만 남긴다.
 * 요약 알림도 버린다.
 */
fun collectNoticePieces(draft: NoticeDraft): List<NoticePiece> {
    if (draft.packageName !in MESSAGE_NOTICE_PACKAGES) return emptyList()
    val pieces = ArrayList<NoticePiece>()
    val seen = HashSet<String>()
    fun add(sender: String, raw: String, time: Long, method: NoticeMethod) {
        for (part in splitBankBlob(raw)) {
            val text = part.trim()
            if (text.isEmpty() || !seen.add(text)) continue
            val at = if (time > 0L) time else draft.whenMillis
            val who = sender.trim().ifEmpty { draft.title.trim() }
            pieces.add(NoticePiece(who, text, at, draft.summary, method))
        }
    }
    for (line in draft.messaging + draft.historic) {
        add(line.sender, line.text, line.timestampMillis, NoticeMethod.A)
    }
    for (line in draft.bundles) add(line.sender, line.text, line.timestampMillis, NoticeMethod.B)
    for (line in draft.lines) add(draft.title, line, 0L, NoticeMethod.C)
    val big = draft.bigText?.trim().orEmpty()
    val plain = draft.text?.trim().orEmpty()
    if (big.isNotEmpty()) add(draft.title, big, 0L, NoticeMethod.D)
    if (plain.isNotEmpty() && plain != big) add(draft.title, plain, 0L, NoticeMethod.D)
    return pieces
}

/** 알림에 글이 없거나, 꺼낸 글에 농협이 없으면 참. */
fun noticeMissedBank(pieces: List<NoticePiece>): Boolean {
    if (pieces.isEmpty()) return true
    return pieces.none { it.text.contains("농협") }
}

fun noticeMethodLetters(draft: NoticeDraft): String {
    if (draft.packageName !in MESSAGE_NOTICE_PACKAGES) return ""
    val letters = StringBuilder()
    if (draft.messaging.any { it.text.isNotBlank() } || draft.historic.any { it.text.isNotBlank() }) letters.append('a')
    if (draft.bundles.any { it.text.isNotBlank() }) letters.append('b')
    if (draft.lines.any { it.isNotBlank() }) letters.append('c')
    if (!draft.bigText.isNullOrBlank() || !draft.text.isNullOrBlank()) letters.append('d')
    return letters.toString()
}
