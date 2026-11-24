package com.cbiseo.depositalert.sms

import android.content.Context
import android.util.Log
import com.cbiseo.depositalert.data.DepositDatabase
import com.cbiseo.depositalert.data.PendingDeposit
import com.cbiseo.depositalert.data.SentDeposit
import com.cbiseo.depositalert.net.DepositApi
import com.cbiseo.depositalert.net.uploadPending
import com.cbiseo.depositalert.store.DeviceSettings
import com.cbiseo.depositalert.work.DepositScheduler

private const val SEVEN_DAYS_MS = 7L * 24 * 60 * 60 * 1000

object DepositIntake {
    suspend fun accept(
        context: Context,
        sender: String,
        rawText: String,
        receivedAtMillis: Long,
        source: IntakeSource = IntakeSource.Sms,
    ): Boolean {
        val queued = enqueue(context, sender, rawText, receivedAtMillis, source)
        if (source == IntakeSource.Sms) InboxScan.run(context)
        return queued
    }

    private suspend fun enqueue(
        context: Context,
        sender: String,
        rawText: String,
        receivedAtMillis: Long,
        source: IntakeSource,
    ): Boolean {
        val settings = DeviceSettings(context)
        val reason = dropReason(rawText)
        if (reason != null) {
            if (source != IntakeSource.Scan) {
                settings.noteDrop(reason)
                settings.noteMessage(false)
                Log.i("DepositAlert", "not deposit")
            }
            return false
        }
        if (source != IntakeSource.Scan && !ArrivalMemory(context).admit(rawText, receivedAtMillis, source)) {
            return false
        }
        val hash = contentHash(sender, rawText)
        val hashes = SentHashMemory(context)
        if (hashes.contains(hash)) {
            if (source != IntakeSource.Scan) settings.noteMessage(true)
            return false
        }
        val preview = previewDeposit(sender, rawText, receivedAtMillis)
        if (!preview.forward) return false
        if (source != IntakeSource.Scan) settings.noteMessage(true)
        val db = DepositDatabase.get(context)
        db.pending().deleteOlderThan(System.currentTimeMillis() - SEVEN_DAYS_MS)
        Log.i("DepositAlert", "deposit queued")
        val inserted = db.pending().insert(
            PendingDeposit(
                dedupeKey = preview.dedupeKey,
                sender = sender.trim().take(40),
                text = preview.stripped,
                receivedAt = receivedAtIso(receivedAtMillis),
                amountLabel = preview.amountLabel,
                depositorName = preview.depositorName,
                createdAt = System.currentTimeMillis(),
                contentHash = hash,
                source = sourceLabel(source),
            ),
        )
        hashes.remember(hash)
        if (inserted == -1L) return false
        if (source == IntakeSource.Scan) settings.noteLateFound(1)
        flush(context)
        if (db.pending().count() > 0) DepositScheduler.enqueueUpload(context)
        return true
    }

    suspend fun flush(context: Context) {
        val db = DepositDatabase.get(context)
        val settings = DeviceSettings(context)
        db.pending().deleteOlderThan(System.currentTimeMillis() - SEVEN_DAYS_MS)
        val token = settings.token()
        if (token.isEmpty()) return
        val api = DepositApi()
        val base = settings.serverBase()
        repeat(10) {
            val batch = db.pending().next(20)
            if (batch.isEmpty()) return
            var askScan = false
            val halt = uploadPending(
                batch,
                post = { rows ->
                    val reply = api.ingest(base, token, rows)
                    if (reply is com.cbiseo.depositalert.net.IngestReply.Done && reply.rescan) askScan = true
                    reply
                },
                onCleared = { row, result -> remember(db, settings, row, result) },
                onUnauthorized = { settings.setNeedsReconnect(true) },
            )
            if (askScan) InboxScan.run(context)
            if (halt != null) return
        }
    }

    private suspend fun remember(
        db: DepositDatabase,
        settings: DeviceSettings,
        row: PendingDeposit,
        result: String,
    ) {
        db.pending().deleteKeys(listOf(row.dedupeKey))
        val now = System.currentTimeMillis()
        db.sent().insert(
            SentDeposit(
                dedupeKey = row.dedupeKey,
                receivedAt = row.receivedAt,
                amountLabel = row.amountLabel,
                depositorName = row.depositorName,
                resultLabel = resultLabel(result),
                createdAt = now,
            ),
        )
        db.sent().prune()
        if (result == "unsent") return
        settings.markSent(now)
        settings.setNeedsReconnect(false)
    }
}
