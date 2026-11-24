package com.cbiseo.depositalert.sms

enum class IntakeSource { Sms, Notice, Scan }

data class PathMarks(val sms: Boolean = false, val notice: Boolean = false)

/**
 * 같은 경로로 다시 오면 통과시킨다. 서버 중복 키가 잔액이 다른 두 입금을 구분한다.
 * 다른 경로가 이미 같은 분·같은 본문을 받았으면 막는다.
 */
fun admitPath(marks: PathMarks, source: IntakeSource): Pair<Boolean, PathMarks> {
    if (source == IntakeSource.Scan) return true to marks
    val mine = if (source == IntakeSource.Sms) marks.sms else marks.notice
    val other = if (source == IntakeSource.Sms) marks.notice else marks.sms
    if (other && !mine) return false to marks
    if (mine) return true to marks
    val next = if (source == IntakeSource.Sms) marks.copy(sms = true) else marks.copy(notice = true)
    return true to next
}

val MESSAGE_NOTICE_PACKAGES = setOf(
    "com.samsung.android.messaging",
    "com.google.android.apps.messaging",
)

/** 기본 메시지 앱의 알림 글만 돌려준다. 다른 앱은 null. */
fun messageNoticeBody(packageName: String, text: String?, bigText: String?, summary: Boolean): String? {
    if (packageName !in MESSAGE_NOTICE_PACKAGES) return null
    if (summary) return null
    val parts = listOf(bigText, text).mapNotNull { value -> value?.trim()?.takeIf { it.isNotEmpty() } }
    return parts.maxByOrNull { it.length }
}
