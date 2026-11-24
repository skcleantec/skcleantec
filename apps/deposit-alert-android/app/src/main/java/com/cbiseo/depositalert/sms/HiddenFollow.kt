package com.cbiseo.depositalert.sms

const val HIDDEN_POLL_MS = 5_000L
const val HIDDEN_WINDOW_MS = 120_000L

enum class SeeResult { None, Armed, StillHidden, Resolved }

/**
 * 메시지 알림인데 글은 있고 농협이 없으면 본문이 가려졌을 수 있다.
 * 글이 하나도 없는 알림은 여기서 다루지 않는다.
 */
fun looksHidden(pieceCount: Int, nhCount: Int): Boolean = pieceCount > 0 && nhCount == 0

/** 화면이 켜지거나 잠금이 풀리면 바로 다시 훑는다. */
fun shouldRescanNow(action: String?): Boolean {
    return action == "android.intent.action.SCREEN_ON" || action == "android.intent.action.USER_PRESENT"
}

private class HiddenItem(val seenAt: Long, var present: Boolean)

/** 가려진 알림을 2분 동안 기억한다. 키는 메모리에만 두고 기록에는 남기지 않는다. */
class HiddenWatch {
    private val open = LinkedHashMap<String, HiddenItem>()
    var deadlineAt: Long = 0L
        private set

    fun see(key: String, hidden: Boolean, now: Long): SeeResult {
        if (key.isEmpty()) return SeeResult.None
        if (!hidden) {
            val had = open.isNotEmpty()
            open.clear()
            if (had) deadlineAt = 0L
            return if (had) SeeResult.Resolved else SeeResult.None
        }
        val existing = open[key]
        if (existing != null) {
            existing.present = true
            return SeeResult.StillHidden
        }
        open[key] = HiddenItem(now, true)
        deadlineAt = maxOf(deadlineAt, now + HIDDEN_WINDOW_MS)
        return SeeResult.Armed
    }

    fun markAbsentExcept(activeKeys: Set<String>) {
        for ((key, item) in open) {
            if (key !in activeKeys) item.present = false
        }
    }

    /** 2분이 지나도록 본문 없이 사라져 있으면 그 개수를 돌려주고 비운다. */
    fun takeLost(now: Long): Int {
        if (deadlineAt <= 0L || now < deadlineAt) return 0
        val lost = open.values.count { !it.present }
        open.clear()
        deadlineAt = 0L
        return lost
    }

    fun nextPollDelay(now: Long): Long? {
        if (deadlineAt <= 0L || now >= deadlineAt) return null
        return minOf(HIDDEN_POLL_MS, deadlineAt - now)
    }
}

object HiddenFollowScheduler {
    @Volatile
    var onArm: (() -> Unit)? = null

    fun arm() {
        onArm?.invoke()
    }
}

object HiddenWatchHub {
    private val watch = HiddenWatch()
    private val gate = Any()

    fun see(key: String, hidden: Boolean, now: Long): SeeResult = synchronized(gate) { watch.see(key, hidden, now) }

    fun markAbsentExcept(activeKeys: Set<String>) = synchronized(gate) { watch.markAbsentExcept(activeKeys) }

    fun takeLost(now: Long): Int = synchronized(gate) { watch.takeLost(now) }

    fun nextPollDelay(now: Long): Long? = synchronized(gate) { watch.nextPollDelay(now) }
}
