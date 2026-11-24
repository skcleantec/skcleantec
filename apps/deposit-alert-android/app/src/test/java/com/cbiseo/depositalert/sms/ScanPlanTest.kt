package com.cbiseo.depositalert.sms

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScanPlanTest {
    private val at = 1_763_942_650_000L

    @Test
    fun contentHashIgnoresTimeAndChangesWithBalance() {
        val other = SAMPLE_NH_SMS.replace("4,041,585", "9,999")
        assertEquals(contentHash("15882100", SAMPLE_NH_SMS), contentHash("15882100", SAMPLE_NH_SMS))
        assertNotEquals(contentHash("15882100", SAMPLE_NH_SMS), contentHash("15882100", other))
        val sameTextLater = InboxLine("15882100", SAMPLE_NH_SMS, at + 3_600_000)
        val choice = chooseScan(
            listOf(InboxLine("15882100", SAMPLE_NH_SMS, at), sameTextLater),
            already = setOf(contentHash("15882100", SAMPLE_NH_SMS)),
            nowMillis = at + 3_600_000,
        )
        assertTrue(choice.picks.isEmpty())
    }

    @Test
    fun chooseScanKeepsOnlyNewDepositsInsideTwoDays() {
        val fresh = SAMPLE_NH_SMS
        val other = fresh.replace("4,041,585", "1,000")
        val lines = listOf(
            InboxLine("15882100", fresh, at),
            InboxLine("15882100", other, at),
            InboxLine("15882100", "-농협 출금20,000원", at),
            InboxLine("15882100", "국민 입금20,000원", at),
            InboxLine("15882100", "-농협 안내", at),
            InboxLine("15882100", "-농협 입금20,000원 잔액남음", at),
            InboxLine("15882100", fresh, at - SCAN_WINDOW_MS - 1_000),
        )
        val choice = chooseScan(lines, already = setOf(contentHash("15882100", fresh)), nowMillis = at)
        assertEquals(1, choice.picks.size)
        assertEquals(other, choice.picks.single().body)
        assertEquals(6, choice.scanned)
        assertEquals(1, choice.drops[DropReason.Blocked])
        assertEquals(1, choice.drops[DropReason.NoBank])
        assertEquals(1, choice.drops[DropReason.NoDeposit])
        assertEquals(1, choice.drops[DropReason.BalanceLeft])
    }
}
