package com.cbiseo.depositalert.service

const val WAKE_INTERVAL_MS = 10L * 60L * 1000L
const val KEEP_ALIVE_TYPE = "specialUse"

/** 마지막 깨움 이후 10분이 지났으면 다시 깨운다. */
fun wakeDue(lastAt: Long, now: Long): Boolean = lastAt <= 0L || now - lastAt >= WAKE_INTERVAL_MS

fun nextWakeAt(now: Long): Long = now + WAKE_INTERVAL_MS

/** 정확한 알람을 쓸 수 있으면 그것을 쓴다. */
fun useExactAlarm(canExact: Boolean): Boolean = canExact

/** 다시 올리지 못하면 사용자에게 앱을 열라고 알린다. */
fun timeoutNeedsUser(restarted: Boolean): Boolean = !restarted

/** 바로 보냈는데 대기열이 남아 있으면 긴급 재시도를 건다. */
fun expediteAfterSend(queued: Boolean, stillPending: Boolean): Boolean = queued && stillPending

fun isFgsStartBlocked(exceptionClass: String): Boolean {
    return exceptionClass.endsWith("StartNotAllowedException") ||
        exceptionClass.endsWith("ForegroundServiceDidNotStopInTimeException")
}

fun exitReasonLabel(reason: Int): String = when (reason) {
    3 -> "lowMemory"
    4 -> "crash"
    5 -> "nativeCrash"
    6 -> "anr"
    10 -> "user"
    13 -> "other"
    14 -> "freezer"
    16 -> "updated"
    else -> "reason$reason"
}
