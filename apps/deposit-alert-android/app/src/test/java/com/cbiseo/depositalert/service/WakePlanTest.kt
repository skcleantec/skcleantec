package com.cbiseo.depositalert.service

import com.cbiseo.depositalert.net.HeartbeatSnapshot
import com.cbiseo.depositalert.net.heartbeatBody
import com.cbiseo.depositalert.sms.wakePromptText
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WakePlanTest {
    @Test
    fun sendsImmediatelyAndRetriesOnlyWhenSomeRemain() {
        assertFalse(expediteAfterSend(queued = false, stillPending = true))
        assertFalse(expediteAfterSend(queued = true, stillPending = false))
        assertTrue(expediteAfterSend(queued = true, stillPending = true))
    }

    @Test
    fun wakesEveryTenMinutesAndPrefersExact() {
        assertTrue(wakeDue(lastAt = 0L, now = 1L))
        assertFalse(wakeDue(lastAt = 1_000L, now = 1_000L + WAKE_INTERVAL_MS - 1))
        assertTrue(wakeDue(lastAt = 1_000L, now = 1_000L + WAKE_INTERVAL_MS))
        assertEquals(5_000L + WAKE_INTERVAL_MS, nextWakeAt(5_000L))
        assertTrue(useExactAlarm(true))
        assertFalse(useExactAlarm(false))
    }

    @Test
    fun timeoutAsksTheUserOnlyWhenRestartFails() {
        assertFalse(timeoutNeedsUser(restarted = true))
        assertTrue(timeoutNeedsUser(restarted = false))
        assertTrue(isFgsStartBlocked("android.app.ForegroundServiceStartNotAllowedException"))
        assertFalse(isFgsStartBlocked("java.lang.IllegalStateException"))
        assertEquals("crash", exitReasonLabel(4))
        assertEquals(
            "입금 알림 앱을 한 번 열어 주세요. 지금 입금을 서버로 보내지 못하고 있어요.",
            wakePromptText(),
        )
    }

    @Test
    fun heartbeatCarriesTheServiceHealthWithoutSecrets() {
        val body = heartbeatBody(
            HeartbeatSnapshot(
                appVersion = "0.1.10",
                listenerConnected = true,
                noticeAccessEnabled = true,
                keepAliveRunning = false,
                batteryUnrestricted = true,
                lastNoticeAt = 10L,
                posts = 1,
                extracted = 1,
                deposits = 1,
                missed = 0,
                rebinds = 0,
                sent = 1,
                keepAliveType = KEEP_ALIVE_TYPE,
                lastExitReason = "crash",
                lastExitAt = 20L,
                restarts = 3,
                fgsTimeoutCount = 2,
            ),
        )
        val json = JSONObject(body)
        assertEquals("specialUse", json.getString("keepAliveType"))
        assertEquals("crash", json.getString("lastExitReason"))
        assertEquals(20L, json.getLong("lastExitAt"))
        assertEquals(3, json.getInt("restarts"))
        assertEquals(2, json.getInt("fgsTimeoutCount"))
        assertFalse(body.contains("token"))
        assertFalse(body.contains("잔액"))
    }
}
