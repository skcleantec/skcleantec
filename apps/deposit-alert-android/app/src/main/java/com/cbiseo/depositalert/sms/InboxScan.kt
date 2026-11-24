package com.cbiseo.depositalert.sms

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
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
        val lines = ArrayList<InboxLine>()
        context.contentResolver.query(
            Uri.parse("content://sms/inbox"),
            arrayOf("address", "body", "date"),
            "date>=?",
            arrayOf(cutoff.toString()),
            null,
        )?.use { cursor ->
            val senderCol = cursor.getColumnIndex("address")
            val bodyCol = cursor.getColumnIndex("body")
            val dateCol = cursor.getColumnIndex("date")
            while (cursor.moveToNext()) {
                lines.add(
                    InboxLine(
                        sender = if (senderCol >= 0) cursor.getString(senderCol).orEmpty() else "",
                        body = if (bodyCol >= 0) cursor.getString(bodyCol).orEmpty() else "",
                        receivedAtMillis = if (dateCol >= 0) cursor.getLong(dateCol) else 0L,
                    ),
                )
            }
        }
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
        Log.i("DepositAlert", "scan done scanned=${choice.scanned} found=$found")
        val token = settings.token()
        if (token.isEmpty()) return
        val code = DepositApi().scanReport(settings.serverBase(), token, choice.scanned, found)
        if (code == 401) settings.setNeedsReconnect(true)
    }
}
