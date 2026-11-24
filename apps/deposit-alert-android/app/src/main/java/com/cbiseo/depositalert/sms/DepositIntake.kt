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
        summary: Boolean = false,
        countDup: Boolean = true,
    ): IntakeOutcome {
        val outcome = enqueue(context, sender, rawText, receivedAtMillis, source, summary, countDup)
        if (source == IntakeSource.Sms) InboxScan.run(context)
        return outcome
    }

    private suspend fun enqueue(
        context: Context,
        sender: String,
        rawText: String,
        receivedAtMillis: Long,
        source: IntakeSource,
        summary: Boolean,
        countDup: Boolean,
    ): IntakeOutcome {
        val settings = DeviceSettings(context)
        val notice = source == IntakeSource.Notice || source == IntakeSource.NoticeRescan
        val reason = dropReason(rawText)
        if (reason != null) {
            if (!notice && source != IntakeSource.Scan) {
                settings.noteDrop(reason)
                settings.noteMessage(false)
                Log.i("DepositAlert", "not deposit")
            }
            return IntakeOutcome.NotDeposit
        }
        val admitted = source == IntakeSource.Scan || ArrivalMemory(context).admit(rawText, receivedAtMillis, source)
        val hash = contentHash(sender, rawText)
        val hashes = SentHashMemory(context)
        val already = hashes.contains(hash)
        if (notice) {
            val fate = fateOfRemovedNotice(isDeposit = true, hashAlreadySent = already, otherPathAlready = !admitted)
            if (fate != NoticeFate.Send) {
                if (already && countDup) settings.noteNoticeDup()
                return IntakeOutcome.Duplicate
            }
        } else if (!admitted) {
            return IntakeOutcome.Duplicate
        } else if (already) {
            if (source != IntakeSource.Scan) settings.noteMessage(true)
            return IntakeOutcome.Duplicate
        }
        val preview = previewDeposit(sender, rawText, receivedAtMillis)
        if (!preview.forward) return IntakeOutcome.NotDeposit
        if (!notice && source != IntakeSource.Scan) settings.noteMessage(true)
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
        if (inserted == -1L) {
            if (notice && countDup) settings.noteNoticeDup()
            return IntakeOutcome.Duplicate
        }
        if (notice) settings.noteNoticeSent(summary, source == IntakeSource.NoticeRescan)
        if (source == IntakeSource.Scan) settings.noteLateFound(1)
        flush(context)
        if (db.pending().count() > 0) DepositScheduler.enqueueUpload(context)
        return IntakeOutcome.Queued
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
        if (row.source == "notification" && (result == "skipped" || result == "unsent")) {
            settings.noteNoticeRejected()
        }
        if (result == "unsent") return
        settings.markSent(now)
        settings.setNeedsReconnect(false)
    }
}
