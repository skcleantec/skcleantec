package com.cbiseo.depositalert.net

import com.cbiseo.depositalert.data.PendingDeposit

sealed class UploadHalt {
    data object Retry : UploadHalt()
    data object Unauthorized : UploadHalt()
}

/**
 * 묶음이 400이면 한 건씩 다시 보낸다.
 * 한 건도 400이면 그 건만 빼고, 429·5xx·연결 실패는 나머지를 대기열에 둔다.
 */
suspend fun uploadPending(
    items: List<PendingDeposit>,
    post: suspend (List<PendingDeposit>) -> IngestReply,
    onCleared: suspend (PendingDeposit, String) -> Unit,
    onUnauthorized: suspend () -> Unit,
): UploadHalt? {
    if (items.isEmpty()) return null
    return applyReply(items, post(items), post, onCleared, onUnauthorized, split = items.size > 1)
}

private suspend fun applyReply(
    items: List<PendingDeposit>,
    reply: IngestReply,
    post: suspend (List<PendingDeposit>) -> IngestReply,
    onCleared: suspend (PendingDeposit, String) -> Unit,
    onUnauthorized: suspend () -> Unit,
    split: Boolean,
): UploadHalt? {
    return when (reply) {
        is IngestReply.Done -> {
            val byKey = items.associateBy { it.dedupeKey }
            for (item in reply.items) {
                val row = byKey[item.dedupeKey] ?: continue
                onCleared(row, item.result)
            }
            null
        }
        IngestReply.Unauthorized -> {
            onUnauthorized()
            UploadHalt.Unauthorized
        }
        IngestReply.Retry -> UploadHalt.Retry
        IngestReply.Rejected -> {
            if (!split) {
                val row = items.singleOrNull() ?: return UploadHalt.Retry
                onCleared(row, "unsent")
                null
            } else {
                for (row in items) {
                    val one = listOf(row)
                    val halt = applyReply(one, post(one), post, onCleared, onUnauthorized, split = false)
                    if (halt != null) return halt
                }
                null
            }
        }
    }
}
