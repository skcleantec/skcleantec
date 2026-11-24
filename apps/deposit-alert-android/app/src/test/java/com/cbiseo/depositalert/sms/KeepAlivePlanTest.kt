package com.cbiseo.depositalert.sms

import com.cbiseo.depositalert.net.HeartbeatSnapshot
import com.cbiseo.depositalert.net.heartbeatBody
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KeepAlivePlanTest {
    @Test
    fun minuteCheckRebindsWhenDownAndRescansWhenUp() {
        assertEquals(
            MaintainChoice.Rebind,
            chooseMaintain(listening = true, messageNotice = true, accessEnabled = true, listenerConnected = false, listenerBound = true),
        )
        assertEquals(
            MaintainChoice.Rebind,
            chooseMaintain(listening = true, messageNotice = true, accessEnabled = true, listenerConnected = true, listenerBound = false),
        )
        assertEquals(
            MaintainChoice.Rescan,
            chooseMaintain(listening = true, messageNotice = true, accessEnabled = true, listenerConnected = true, listenerBound = true),
        )
        assertEquals(
            MaintainChoice.Skip,
            chooseMaintain(listening = false, messageNotice = true, accessEnabled = true, listenerConnected = true, listenerBound = true),
        )
        assertEquals(
            MaintainChoice.Skip,
            chooseMaintain(listening = true, messageNotice = true, accessEnabled = false, listenerConnected = false, listenerBound = false),
        )
        assertFalse(heartbeatDue(1))
        assertFalse(heartbeatDue(4))
        assertTrue(heartbeatDue(5))
        assertTrue(heartbeatDue(10))
        assertFalse(heartbeatDue(0))
    }

    @Test
    fun removedNoticeIsTakenAgainAndBlockedWhenAlreadySent() {
        assertEquals(NoticeFate.Send, fateOfRemovedNotice(isDeposit = true, hashAlreadySent = false, otherPathAlready = false))
        assertEquals(NoticeFate.AlreadySent, fateOfRemovedNotice(isDeposit = true, hashAlreadySent = true, otherPathAlready = false))
        assertEquals(NoticeFate.AlreadySent, fateOfRemovedNotice(isDeposit = true, hashAlreadySent = false, otherPathAlready = true))
        assertEquals(NoticeFate.NotDeposit, fateOfRemovedNotice(isDeposit = false, hashAlreadySent = false, otherPathAlready = false))

        val posted = admitPath(PathMarks(), IntakeSource.Notice)
        assertTrue(posted.first)
        val removed = admitPath(posted.second, IntakeSource.NoticeRescan)
        assertTrue(removed.first)

        val hash = contentHash("15882100", SAMPLE_NH_SMS)
        val sent = hashSetOf(hash)
        assertEquals(NoticeFate.AlreadySent, fateOfRemovedNotice(isDeposit = true, hashAlreadySent = hash in sent, otherPathAlready = false))
        assertEquals(NoticeFate.Send, fateOfRemovedNotice(isDeposit = true, hashAlreadySent = false, otherPathAlready = false))
        assertEquals(
            NoticeRecordResult.AlreadySent,
            classifyNoticeRecord(1, listOf(IntakeOutcome.Duplicate), missedBank = false),
        )
        assertEquals(
            NoticeRecordResult.Sent,
            classifyNoticeRecord(2, listOf(IntakeOutcome.NotDeposit, IntakeOutcome.Queued), missedBank = false),
        )
        assertEquals(
            NoticeRecordResult.Unread,
            classifyNoticeRecord(0, emptyList(), missedBank = true),
        )
        val kept = trimNoticeLog(
            List(21) {
                NoticeRecord(
                    atMillis = it.toLong() + 1,
                    methods = "a",
                    pieces = 1,
                    nhPieces = 1,
                    depositShape = 1,
                    tally = NoticeTally(sent = 1),
                    locked = false,
                    summary = false,
                )
            },
        )
        assertEquals(20, kept.size)
        assertEquals(2L, kept.first().atMillis)
    }

    @Test
    fun heartbeatBodyReportsListenerWithoutSecrets() {
        val body = heartbeatBody(
            HeartbeatSnapshot(
                appVersion = "0.1.7",
                listenerConnected = true,
                noticeAccessEnabled = false,
                keepAliveRunning = true,
                batteryUnrestricted = true,
                lastNoticeAt = 1_795_508_719_653L,
                posts = 22,
                extracted = 3,
                deposits = 1,
                missed = 8,
                rebinds = 3,
                sent = 19,
            ),
        )
        val json = JSONObject(body)
        assertEquals("0.1.7", json.getString("appVersion"))
        assertTrue(json.getBoolean("listenerConnected"))
        assertFalse(json.getBoolean("noticeAccessEnabled"))
        assertTrue(json.getBoolean("keepAliveRunning"))
        assertTrue(json.getBoolean("batteryUnrestricted"))
        assertEquals(1_795_508_719_653L, json.getLong("lastNoticeAt"))
        val counters = json.getJSONObject("counters")
        assertEquals(22, counters.getInt("posts"))
        assertEquals(3, counters.getInt("extracted"))
        assertEquals(1, counters.getInt("deposits"))
        assertEquals(8, counters.getInt("missed"))
        assertEquals(3, counters.getInt("rebinds"))
        assertEquals(19, counters.getInt("sent"))
        assertEquals(0, counters.getInt("alreadySent"))
        assertEquals(0, counters.getInt("otherPath"))
        assertEquals(0, counters.getInt("withdrawal"))
        assertEquals(0, counters.getInt("noAmount"))
        assertEquals(0, counters.getInt("notNh"))
        assertEquals(0, counters.getInt("noText"))
        assertEquals(0, counters.getInt("balance"))
        assertEquals(0, counters.getInt("hiddenLost"))
        assertEquals(0L, json.getLong("lastHiddenLostAt"))
        assertFalse(body.contains("token"))
        assertFalse(body.contains("잔액"))
    }
}
