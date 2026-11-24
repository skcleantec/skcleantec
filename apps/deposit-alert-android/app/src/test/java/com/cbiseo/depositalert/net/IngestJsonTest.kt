package com.cbiseo.depositalert.net

import com.cbiseo.depositalert.data.PendingDeposit
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class IngestJsonTest {
    @Test
    fun jsonEscapesTabQuoteAndNewline() {
        val json = ingestJson(
            listOf(
                pending("k", "입금\t\"김\"\n다음"),
            ),
        )
        assertFalse(json.any { it == '\t' || it == '\n' || it == '\r' })
        assertTrue(json.contains("\\\""))
        val text = JSONObject(json).getJSONArray("items").getJSONObject(0).getString("text")
        assertEquals("입금\t\"김\"\n다음", text)
    }

    @Test
    fun badRequestSplitsTheBatchAndDropsOnlyThePoison() = runBlocking {
        val calls = mutableListOf<List<String>>()
        val cleared = mutableListOf<Pair<String, String>>()
        val halt = uploadPending(
            listOf(pending("a", "입금"), pending("b", "입금\t막힘"), pending("c", "입금2")),
            post = { batch ->
                calls += batch.map { it.dedupeKey }
                when {
                    batch.size > 1 -> IngestReply.Rejected
                    batch.single().dedupeKey == "b" -> IngestReply.Rejected
                    else -> IngestReply.Done(listOf(ClearedItem(batch.single().dedupeKey, "stored")))
                }
            },
            onCleared = { row, result -> cleared += row.dedupeKey to result },
            onUnauthorized = {},
        )
        assertNull(halt)
        assertEquals(listOf(listOf("a", "b", "c"), listOf("a"), listOf("b"), listOf("c")), calls)
        assertEquals(listOf("a" to "stored", "b" to "unsent", "c" to "stored"), cleared)
    }

    @Test
    fun rateLimitStopsAndLeavesTheRestQueued() = runBlocking {
        val calls = mutableListOf<List<String>>()
        val cleared = mutableListOf<String>()
        val halt = uploadPending(
            listOf(pending("a", "입금"), pending("b", "나중")),
            post = { batch ->
                calls += batch.map { it.dedupeKey }
                if (batch.size > 1) return@uploadPending IngestReply.Rejected
                if (batch.single().dedupeKey == "b") IngestReply.Retry else IngestReply.Done(listOf(ClearedItem("a", "stored")))
            },
            onCleared = { row, _ -> cleared += row.dedupeKey },
            onUnauthorized = {},
        )
        assertTrue(halt is UploadHalt.Retry)
        assertEquals(listOf("a"), cleared)
        assertEquals(listOf(listOf("a", "b"), listOf("a"), listOf("b")), calls)
    }

    private fun pending(key: String, text: String) = PendingDeposit(
        dedupeKey = key,
        sender = "15882100",
        text = text,
        receivedAt = "2026-11-24T09:04:10+09:00",
        amountLabel = "20,000원",
        depositorName = "김명희",
        createdAt = 0,
    )
}
