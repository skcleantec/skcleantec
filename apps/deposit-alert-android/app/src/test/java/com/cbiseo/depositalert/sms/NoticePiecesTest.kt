package com.cbiseo.depositalert.sms

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NoticePiecesTest {
    private val at = 1_795_000_000_000L

    private fun ten(minute: String) = """
        [Web발신]
        -농협 입금10원
        11/24 $minute 301-****-9047-01 홍길동 잔액100원
    """.trim()

    @Test
    fun messagingStyleKeepsEveryMessage() {
        val first = SAMPLE_NH_SMS
        val second = ten("09:05")
        val pieces = collectNoticePieces(
            NoticeDraft(
                packageName = "com.samsung.android.messaging",
                summary = false,
                title = "알림",
                whenMillis = at,
                messaging = listOf(
                    NoticeLine("1588", first, at),
                    NoticeLine("1588", second, at + 60_000),
                ),
            ),
        )
        assertEquals(listOf(NoticeMethod.A, NoticeMethod.A), pieces.map { it.method })
        assertEquals(listOf(first, second), pieces.map { it.text })
        assertEquals(at + 60_000, pieces[1].receivedAtMillis)
        assertTrue(pieces.all { dropReason(it.text) == null })
    }

    @Test
    fun summaryIsReadAndACountLineDropsNaturally() {
        val pieces = collectNoticePieces(
            NoticeDraft(
                packageName = "com.google.android.apps.messaging",
                summary = true,
                title = "메시지",
                whenMillis = at,
                messaging = listOf(NoticeLine("1588", SAMPLE_NH_SMS, at)),
                text = "새 메시지 3개",
            ),
        )
        assertEquals(1, pieces.count { dropReason(it.text) == null })
        assertTrue(pieces.first { it.text == SAMPLE_NH_SMS }.summary)
        assertTrue(pieces.any { it.text == "새 메시지 3개" && noticeMissedBank(listOf(it)) })
    }

    @Test
    fun oneBlobWithTwoDepositsSplits() {
        val blob = SAMPLE_NH_SMS + "\n" + ten("09:06")
        val pieces = collectNoticePieces(
            NoticeDraft(
                packageName = "com.samsung.android.messaging",
                summary = false,
                title = "알림",
                whenMillis = at,
                bigText = blob,
            ),
        )
        assertEquals(2, pieces.size)
        assertEquals(listOf(NoticeMethod.D, NoticeMethod.D), pieces.map { it.method })
        assertTrue(pieces.all { dropReason(it.text) == null })
        assertTrue(pieces[0].text.contains("입금20,000원"))
        assertTrue(pieces[1].text.contains("입금10원"))
    }

    @Test
    fun sameNoticeThreeTimesSendsOnce() {
        val draft = NoticeDraft(
            packageName = "com.samsung.android.messaging",
            summary = false,
            title = "알림",
            whenMillis = at,
            messaging = listOf(NoticeLine("1588", ten("09:07"), at)),
        )
        val seen = HashSet<String>()
        var sent = 0
        repeat(3) {
            for (piece in collectNoticePieces(draft)) {
                if (dropReason(piece.text) != null) continue
                if (seen.add(contentHash(piece.sender, piece.text))) sent++
            }
        }
        assertEquals(1, sent)
        assertEquals("a", noticeMethodLetters(draft))
    }

    @Test
    fun withdrawalInTheSameBlobIsSplitAndBlocked() {
        val deposit = ten("09:08")
        val withdrawal = deposit.replace("입금", "출금")
        val pieces = collectNoticePieces(
            NoticeDraft(
                packageName = "com.samsung.android.messaging",
                summary = false,
                title = "알림",
                whenMillis = at,
                text = deposit + "\n" + withdrawal,
            ),
        )
        assertEquals(2, pieces.size)
        assertEquals(null, dropReason(pieces[0].text))
        assertEquals(DropReason.Blocked, dropReason(pieces[1].text))
    }

    @Test
    fun emptyBodyAndOtherAppsAreIgnored() {
        val empty = collectNoticePieces(
            NoticeDraft(
                packageName = "com.samsung.android.messaging",
                summary = false,
                title = "알림",
                whenMillis = at,
            ),
        )
        assertTrue(empty.isEmpty())
        assertTrue(noticeMissedBank(empty))
        val other = collectNoticePieces(
            NoticeDraft(
                packageName = "com.kakao.talk",
                summary = false,
                title = "알림",
                whenMillis = at,
                text = SAMPLE_NH_SMS,
            ),
        )
        assertTrue(other.isEmpty())
        assertEquals(
            "",
            noticeMethodLetters(
                NoticeDraft("com.kakao.talk", false, "알림", at, text = SAMPLE_NH_SMS),
            ),
        )
    }
}
