package com.cbiseo.depositalert.sms

import com.cbiseo.depositalert.net.IngestReply
import com.cbiseo.depositalert.net.interpretIngest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class DepositMessageTest {
    private val at = ZonedDateTime.of(2026, 11, 24, 9, 4, 10, 0, ZoneId.of("Asia/Seoul")).toInstant().toEpochMilli()

    @Test
    fun keepsNhDepositAndDropsTheRest() {
        assertTrue(shouldForwardDeposit(SAMPLE_NH_SMS))
        assertFalse(shouldForwardDeposit("-농협 출금20,000원\n11/24 09:04 김명희"))
        assertFalse(shouldForwardDeposit("-농협 결제20,000원 입금안내"))
        assertFalse(shouldForwardDeposit("-농협 입금20,000원 광고"))
        assertFalse(shouldForwardDeposit("국민 입금20,000원"))
        assertFalse(shouldForwardDeposit("-농협 안내"))
    }

    @Test
    fun stripsBalanceAndKeepsAmount() {
        val stripped = stripBalance(SAMPLE_NH_SMS)
        assertTrue(balanceRemoved(stripped))
        assertFalse(stripped.contains("4,041,585"))
        assertFalse(stripped.contains("4041585"))
        assertTrue(stripped.contains("입금20,000원"))
        assertTrue(stripped.contains("김명희"))
        assertTrue(balanceRemoved(stripBalance("잔액 4,041,585원 잔액4,041,585 원")))
        val (amount, name) = displayFields(stripped)
        assertEquals("20,000원", amount)
        assertEquals("김명희", name)
    }

    @Test
    fun joinsMultipartBeforeFilter() {
        val parts = listOf(
            "[Web발신]\n-농협 입금20,000원\n",
            "11/24 09:04 301-****-9047-01 김명희 잔액4,041,585원",
        )
        val joined = joinSmsParts(parts)
        val preview = previewDeposit("15882100", joined, at)
        assertTrue(preview.forward)
        assertTrue(balanceRemoved(preview.stripped))
        assertEquals("20,000원", preview.amountLabel)
        assertEquals("김명희", preview.depositorName)
    }

    @Test
    fun dedupeKeyUsesSenderStrippedBodyAndMinute() {
        val stripped = stripBalance(SAMPLE_NH_SMS)
        val first = dedupeKey("15882100", stripped, at)
        val sameMinute = dedupeKey("15882100", stripped, at + 30_000)
        val nextMinute = dedupeKey("15882100", stripped, at + 60_000)
        val otherSender = dedupeKey("15880000", stripped, at)
        assertEquals(64, first.length)
        assertEquals(first, sameMinute)
        assertNotEquals(first, nextMinute)
        assertNotEquals(first, otherSender)
        assertFalse(first.contains("4,041,585"))
    }

    @Test
    fun ingestResultsAllLeaveTheQueue() {
        val body = """{"results":[{"dedupeKey":"a","result":"stored"},{"dedupeKey":"b","result":"duplicate"},{"dedupeKey":"c","result":"skipped"}]}"""
        val reply = interpretIngest(200, body, listOf("a", "b", "c"))
        val done = reply as IngestReply.Done
        assertEquals(listOf("stored", "duplicate", "skipped"), done.items.map { it.result })
        val counts = interpretIngest(200, """{"stored":1,"duplicate":0,"skipped":0}""", listOf("a"))
        assertEquals("a", (counts as IngestReply.Done).items.single().dedupeKey)
        assertTrue(interpretIngest(401, """{"error":"no"}""", listOf("a")) is IngestReply.Unauthorized)
        assertTrue(interpretIngest(429, """{"error":"rate"}""", listOf("a")) is IngestReply.Retry)
    }
}
