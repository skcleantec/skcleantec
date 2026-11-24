package com.cbiseo.depositalert.sms

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId

class HiddenFollowTest {
    @Test
    fun hiddenMeansTextWithoutNh() {
        assertTrue(looksHidden(pieceCount = 1, nhCount = 0))
        assertFalse(looksHidden(pieceCount = 0, nhCount = 0))
        assertFalse(looksHidden(pieceCount = 7, nhCount = 7))
    }

    @Test
    fun followStartsForTwoMinutesAndPollsEveryFiveSeconds() {
        val watch = HiddenWatch()
        assertEquals(SeeResult.Armed, watch.see("one", hidden = true, now = 1_000L))
        assertEquals(1_000L + HIDDEN_WINDOW_MS, watch.deadlineAt)
        assertEquals(HIDDEN_POLL_MS, watch.nextPollDelay(1_000L))
        assertEquals(SeeResult.StillHidden, watch.see("one", hidden = true, now = 20_000L))
        assertEquals(1_000L + HIDDEN_WINDOW_MS, watch.deadlineAt)
        assertEquals(3_000L, watch.nextPollDelay(118_000L))
        assertNull(watch.nextPollDelay(1_000L + HIDDEN_WINDOW_MS))
    }

    @Test
    fun screenOnAndUnlockRescanImmediately() {
        assertTrue(shouldRescanNow("android.intent.action.SCREEN_ON"))
        assertTrue(shouldRescanNow("android.intent.action.USER_PRESENT"))
        assertFalse(shouldRescanNow("android.intent.action.SCREEN_OFF"))
        assertFalse(shouldRescanNow(null))
    }

    @Test
    fun goneWithoutBodyIsLostOnlyAfterTheWindow() {
        val watch = HiddenWatch()
        watch.see("one", hidden = true, now = 0L)
        watch.markAbsentExcept(emptySet())
        assertEquals(0, watch.takeLost(HIDDEN_WINDOW_MS - 1))
        assertEquals(1, watch.takeLost(HIDDEN_WINDOW_MS))
        assertEquals(0, watch.takeLost(HIDDEN_WINDOW_MS + 5_000L))
    }

    @Test
    fun bodyArrivalClearsTheWatchAndDedupeStillHolds() {
        val watch = HiddenWatch()
        watch.see("one", hidden = true, now = 0L)
        watch.markAbsentExcept(emptySet())
        assertEquals(SeeResult.Resolved, watch.see("two", hidden = false, now = 10_000L))
        assertNull(watch.nextPollDelay(10_000L))
        assertEquals(0, watch.takeLost(HIDDEN_WINDOW_MS))
        val hash = contentHash("15882100", SAMPLE_NH_SMS)
        assertEquals(hash, contentHash("15882100", SAMPLE_NH_SMS))
        assertEquals(NoticeFate.AlreadySent, fateOfRemovedNotice(isDeposit = true, hashAlreadySent = true, otherPathAlready = false))
    }

    @Test
    fun lostRecordKeepsThePhraseWithoutTheBody() {
        val zone = ZoneId.of("Asia/Seoul")
        val hidden = NoticeRecord(
            atMillis = 1_795_515_171_084L,
            methods = "abd",
            pieces = 1,
            nhPieces = 0,
            depositShape = 0,
            tally = NoticeTally(notNh = 1),
            locked = true,
            summary = false,
            maybeHidden = true,
        )
        val hiddenLine = formatNoticeLine(hidden, zone)
        assertTrue(hiddenLine.contains("가려졌을 수 있음"))
        assertFalse(hiddenLine.contains("잔액"))
        val lost = NoticeRecord(
            atMillis = hidden.atMillis,
            methods = "",
            pieces = 0,
            nhPieces = 0,
            depositShape = 0,
            tally = NoticeTally(hiddenLost = 1),
            locked = true,
            summary = false,
        )
        val lostLine = formatNoticeLine(lost, zone)
        assertEquals(true, lostLine.endsWith("가려진 알림이 본문 없이 사라짐"))
        val stored = encodeNoticeRecord(lost)
        assertFalse(stored.contains("입금"))
        assertFalse(stored.contains("잔액"))
        assertFalse(stored.contains("김"))
        assertEquals(1, decodeNoticeRecord(stored)?.tally?.hiddenLost)
        assertEquals("입금 문자 1건을 읽지 못했어요. 눌러서 확인", missedDepositNoticeText(1))
    }
}
