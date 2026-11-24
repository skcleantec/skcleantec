package com.cbiseo.depositalert

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.cbiseo.depositalert.data.DepositDatabase
import com.cbiseo.depositalert.sms.DepositIntake
import com.cbiseo.depositalert.sms.SAMPLE_NH_SMS
import com.cbiseo.depositalert.store.DeviceSettings
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.time.ZoneId
import java.time.ZonedDateTime

@RunWith(AndroidJUnit4::class)
class DepositFlowTest {
    @Test
    fun sampleSmsReachesFakeServerWithoutBalance() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val db = DepositDatabase.get(context)
        db.pending().clear()
        val server = MockWebServer()
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"deviceId":"d","token":"issued"}"""))
        server.enqueue(MockResponse().setBody("""{"stored":1,"duplicate":0,"skipped":0}"""))
        server.start()
        try {
            val base = server.url("/").toString().trimEnd('/')
            val settings = DeviceSettings(context)
            val registered = com.cbiseo.depositalert.net.DepositApi().register(base, "123456", "Pixel", "test")
            assertTrue(registered is com.cbiseo.depositalert.net.RegisterReply.Ok)
            settings.saveToken((registered as com.cbiseo.depositalert.net.RegisterReply.Ok).token)
            settings.setServerBase(base)
            settings.setListening(true)
            val at = ZonedDateTime.of(2026, 11, 24, 9, 4, 10, 0, ZoneId.of("Asia/Seoul")).toInstant().toEpochMilli()
            DepositIntake.accept(context, "15882100", SAMPLE_NH_SMS, at)
            val sent = server.takeRequest()
            assertTrue(sent.path?.contains("/devices/register") == true)
            val ingest = server.takeRequest()
            val body = ingest.body.readUtf8()
            assertTrue(ingest.path?.contains("/ingest") == true)
            assertTrue(ingest.getHeader("Authorization")?.startsWith("Bearer ") == true)
            assertFalse(body.contains("4,041,585"))
            assertFalse(body.contains("잔액"))
            assertTrue(body.contains("입금20,000원"))
            assertTrue(body.contains("김명희"))
            assertEquals(0, db.pending().count())
            assertEquals("보냄", db.sent().recent().first().resultLabel)
            settings.clearToken()
            db.pending().clear()
        } finally {
            server.shutdown()
        }
    }
}
