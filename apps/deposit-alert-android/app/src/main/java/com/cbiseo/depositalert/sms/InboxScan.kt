package com.cbiseo.depositalert.sms

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.cbiseo.depositalert.net.DepositApi
import com.cbiseo.depositalert.store.DeviceSettings
import java.util.concurrent.atomic.AtomicBoolean

/** 문자함의 최근 48시간을 훑어 빠진 농협 입금만 보낸다. 다른 문자는 저장하지 않는다. */
object InboxScan {
    private val gate = AtomicBoolean(false)
    private val again = AtomicBoolean(false)

    suspend fun run(context: Context) {
        val app = context.applicationContext
        if (!gate.compareAndSet(false, true)) {
            again.set(true)
            return
        }
        try {
            do {
                again.set(false)
                scanOnce(app)
            } while (again.getAndSet(false))
        } finally {
            gate.set(false)
        }
    }

    private suspend fun scanOnce(context: Context) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        val now = System.currentTimeMillis()
        val cutoff = now - SCAN_WINDOW_MS
        val sms = readSmsInbox(context, cutoff)
        val mms = try {
            readMmsInbox(context, cutoff)
        } catch (_: Exception) {
            Log.i("DepositAlert", "mms read failed")
            emptyList()
        }
        val lines = ArrayList<InboxLine>(sms.size + mms.size)
        lines.addAll(sms)
        lines.addAll(mms)
        val choice = chooseScan(lines, SentHashMemory(context).snapshot(), now)
        lines.clear()
        val settings = DeviceSettings(context)
        settings.noteDrops(choice.drops)
        var found = 0
        for (line in choice.picks) {
            val queued = DepositIntake.accept(context, line.sender, line.body, line.receivedAtMillis, IntakeSource.Scan)
            if (queued) found++
        }
        settings.markScan(now, found)
        Log.i("DepositAlert", "scan done scanned=${choice.scanned} found=$found sms=${sms.size} mms=${mms.size}")
        val token = settings.token()
        if (token.isEmpty()) return
        // 서버에 이 주소가 없으면 직원 로그인 검사로 빠져 401이 온다. 기기 연결이 끊긴 것이 아니다.
        DepositApi().scanReport(settings.serverBase(), token, choice.scanned, found)
    }
}

private fun readSmsInbox(context: Context, cutoffMillis: Long): List<InboxLine> {
    val lines = ArrayList<InboxLine>()
    val cursor = context.contentResolver.query(
        android.net.Uri.parse("content://sms/inbox"),
        arrayOf("address", "body", "date"),
        "date>=?",
        arrayOf(cutoffMillis.toString()),
        null,
    ) ?: return lines
    cursor.use {
        val senderCol = it.getColumnIndex("address")
        val bodyCol = it.getColumnIndex("body")
        val dateCol = it.getColumnIndex("date")
        while (it.moveToNext()) {
            lines.add(
                InboxLine(
                    sender = if (senderCol >= 0) it.getString(senderCol).orEmpty() else "",
                    body = if (bodyCol >= 0) it.getString(bodyCol).orEmpty() else "",
                    receivedAtMillis = if (dateCol >= 0) it.getLong(dateCol) else 0L,
                ),
            )
        }
    }
    return lines
}
