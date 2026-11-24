package com.cbiseo.depositalert.sms

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class DropRuleTest {
    private val at = ZonedDateTime.of(2026, 11, 24, 17, 25, 0, 0, ZoneId.of("Asia/Seoul")).toInstant().toEpochMilli()

    @Test
    fun nameWordsDoNotDropARealDeposit() {
        for (name in listOf("김결제", "김광고", "김출금")) {
            val text = """
                [Web발신]
                -농협 입금520,000원
                11/24 17:25 301-****-0000-01 $name 잔액1,000원
            """.trim()
            assertNull(dropReason(text))
            val preview = previewDeposit("15882100", text, at)
            assertTrue(preview.forward)
            assertTrue(balanceRemoved(preview.stripped))
            assertEquals("520,000원", preview.amountLabel)
            assertEquals(name, preview.depositorName)
        }
    }

    @Test
    fun withdrawalLeadIsDropped() {
        val text = "[Web발신]\n-농협 출금20,000원\n11/24 17:25 김명희 잔액1,000원"
        assertEquals(DropReason.Blocked, dropReason(text))
        assertTrue(depositSlices(text).isEmpty())
        assertFalse(previewDeposit("15882100", text, at).forward)
    }

    @Test
    fun mixedBlobSendsOnlyTheDepositSlice() {
        val mixed = SAMPLE_NH_SMS + "\n-농협 출금10,000원\n11/24 09:05 홍길동 잔액9원"
        val slices = depositSlices(mixed)
        assertEquals(1, slices.size)
        assertTrue(slices.single().contains("입금"))
        assertFalse(slices.single().contains("농협 출금"))
        val preview = previewDeposit("15882100", mixed, at)
        assertTrue(preview.forward)
        assertFalse(preview.stripped.contains("농협 출금"))
        assertTrue(balanceRemoved(preview.stripped))
    }

    @Test
    fun missingAmountOrOtherBankIsDropped() {
        assertEquals(DropReason.NoDeposit, dropReason("-농협 안내"))
        assertEquals(DropReason.NoDeposit, dropReason("-농협 결제20,000원 입금안내"))
        assertEquals(DropReason.NoBank, dropReason("국민 입금20,000원"))
        assertFalse(shouldForwardDeposit("-농협 안내"))
    }

    @Test
    fun leftoverBalanceIsNotSent() {
        val text = "-농협 입금20,000원 잔액남음"
        assertEquals(DropReason.BalanceLeft, dropReason(text))
        assertFalse(previewDeposit("15882100", text, at).forward)
        assertTrue(previewDeposit("15882100", text, at).stripped.isEmpty())
    }

    @Test
    fun noticeRecordKeepsTheReasonWithoutTheBody() {
        val record = NoticeRecord(
            atMillis = at,
            methods = "ad",
            pieces = 2,
            nhPieces = 2,
            depositShape = 1,
            tally = NoticeTally(sent = 1, withdrawal = 1),
            locked = true,
            summary = false,
        )
        val stored = encodeNoticeRecord(record)
        assertFalse(stored.contains("입금"))
        assertFalse(stored.contains("출금"))
        assertFalse(stored.contains("잔액"))
        assertFalse(stored.contains("김"))
        assertFalse(stored.contains("301"))
        assertFalse(stored.contains("520"))
        val back = decodeNoticeRecord(stored)
        assertEquals(record.atMillis, back?.atMillis)
        assertEquals("ad", back?.methods)
        assertEquals(1, back?.tally?.sent)
        assertEquals(1, back?.tally?.withdrawal)
        assertTrue(back?.locked == true)
        val line = formatNoticeLine(record, ZoneId.of("Asia/Seoul"))
        assertTrue(line.contains("보냄1"))
        assertTrue(line.contains("출금1"))
        assertTrue(line.contains("잠금"))
        assertFalse(line.contains("잔액"))
        assertFalse(line.contains("김"))
        assertNull(decodeNoticeRecord("$at|ad본문|1|1|1|1|0|0|0|0|0|0|0|1|0"))
    }
}
