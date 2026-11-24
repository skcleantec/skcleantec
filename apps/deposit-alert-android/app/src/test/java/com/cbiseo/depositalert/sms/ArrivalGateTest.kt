package com.cbiseo.depositalert.sms

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class ArrivalGateTest {
    private val at = ZonedDateTime.of(2026, 11, 24, 9, 4, 10, 0, ZoneId.of("Asia/Seoul")).toInstant().toEpochMilli()

    @Test
    fun noticeAfterSmsIsBlockedButAnotherSmsIsNot() {
        val first = admitPath(PathMarks(), IntakeSource.Sms)
        assertTrue(first.first)
        val notice = admitPath(first.second, IntakeSource.Notice)
        assertFalse(notice.first)
        val again = admitPath(first.second, IntakeSource.Sms)
        assertTrue(again.first)
    }

    @Test
    fun differentBalanceSameMinuteSharesCrossPathKeyOnly() {
        val other = SAMPLE_NH_SMS.replace("4,041,585", "9,999")
        assertEquals(crossPathKey(SAMPLE_NH_SMS, at), crossPathKey(other, at + 20_000))
        assertNotEquals(dedupeKey("15882100", SAMPLE_NH_SMS, at), dedupeKey("15882100", other, at))
        assertFalse(crossPathKey(SAMPLE_NH_SMS, at).contains("4,041,585"))
    }

    @Test
    fun messageNoticeReadsOnlyTheTwoMessagingApps() {
        val body = messageNoticeBody(
            "com.samsung.android.messaging",
            "짧은글",
            SAMPLE_NH_SMS,
            summary = false,
        )
        assertEquals(SAMPLE_NH_SMS, body)
        assertEquals(
            "입금20,000원",
            messageNoticeBody("com.google.android.apps.messaging", "입금20,000원", null, false),
        )
        assertNull(messageNoticeBody("com.kakao.talk", "입금", "농협 입금", false))
        assertEquals("요약", messageNoticeBody("com.samsung.android.messaging", "요약", "요약", true))
        assertNull(messageNoticeBody("com.samsung.android.messaging", "  ", null, false))
    }
}
