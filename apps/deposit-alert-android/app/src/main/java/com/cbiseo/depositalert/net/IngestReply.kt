package com.cbiseo.depositalert.net

/** 서버 응답을 대기열에서 뺄 건으로 바꾼다. stored·duplicate·skipped 는 모두 보낸 것이다. */

data class ClearedItem(val dedupeKey: String, val result: String)

sealed class RegisterReply {
    data class Ok(val token: String) : RegisterReply()
    data class Fail(val message: String) : RegisterReply()
}

sealed class IngestReply {
    data class Done(val items: List<ClearedItem>) : IngestReply()
    data object Unauthorized : IngestReply()
    data object Retry : IngestReply()
    /** 400 등, 다시 보내도 같은 거절이 나는 응답. */
    data object Rejected : IngestReply()
}

private val OBJECT = Regex("""\{[^{}]*\}""")
private val KEY = Regex(""""dedupeKey"\s*:\s*"([^"]+)"""")
private val RESULT = Regex(""""result"\s*:\s*"(stored|duplicate|skipped)"""")
private val COUNTS = Regex(""""(stored|duplicate|skipped)"\s*:\s*\d+""")

fun interpretIngest(httpCode: Int, body: String, sentKeys: List<String>): IngestReply {
    if (httpCode == 401) return IngestReply.Unauthorized
    if (httpCode == 429 || httpCode in 500..599) return IngestReply.Retry
    if (httpCode !in 200..299) return IngestReply.Rejected
    val parsed = OBJECT.findAll(body).mapNotNull { match ->
        val key = KEY.find(match.value)?.groupValues?.get(1) ?: return@mapNotNull null
        val result = RESULT.find(match.value)?.groupValues?.get(1) ?: return@mapNotNull null
        ClearedItem(key, result)
    }.toList()
    if (parsed.isNotEmpty()) return IngestReply.Done(parsed)
    if (COUNTS.containsMatchIn(body)) {
        return IngestReply.Done(sentKeys.map { ClearedItem(it, "stored") })
    }
    if (sentKeys.isNotEmpty() && body.isBlank()) {
        return IngestReply.Done(sentKeys.map { ClearedItem(it, "stored") })
    }
    return IngestReply.Retry
}
