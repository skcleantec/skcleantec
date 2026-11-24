package com.cbiseo.depositalert.sms

import android.content.Context
import android.util.Log
import com.cbiseo.depositalert.data.DepositDatabase
import com.cbiseo.depositalert.data.PendingDeposit
import com.cbiseo.depositalert.data.SentDeposit
import com.cbiseo.depositalert.net.DepositApi
import com.cbiseo.depositalert.net.IngestReply
import com.cbiseo.depositalert.store.DeviceSettings
import com.cbiseo.depositalert.work.DepositScheduler

private const val SEVEN_DAYS_MS = 7L * 24 * 60 * 60 * 1000

object DepositIntake {
    suspend fun accept(context: Context, sender: String, rawText: String, receivedAtMillis: Long) {
        val preview = previewDeposit(sender, rawText, receivedAtMillis)
        if (!preview.forward) return
        val db = DepositDatabase.get(context)
        db.pending().deleteOlderThan(System.currentTimeMillis() - SEVEN_DAYS_MS)
        Log.i("DepositAlert", "deposit queued")
        db.pending().insert(
            PendingDeposit(
                dedupeKey = preview.dedupeKey,
                sender = sender.trim().take(40),
                text = preview.stripped,
                receivedAt = receivedAtIso(receivedAtMillis),
                amountLabel = preview.amountLabel,
                depositorName = preview.depositorName,
                createdAt = System.currentTimeMillis(),
            ),
        )
        flush(context)
        if (db.pending().count() > 0) DepositScheduler.enqueueUpload(context)
    }

    suspend fun flush(context: Context) {
        val db = DepositDatabase.get(context)
        val settings = DeviceSettings(context)
        db.pending().deleteOlderThan(System.currentTimeMillis() - SEVEN_DAYS_MS)
        val token = settings.token()
        if (token.isEmpty()) return
        val api = DepositApi()
        repeat(10) {
            val batch = db.pending().next(20)
            if (batch.isEmpty()) return
            when (val reply = api.ingest(settings.serverBase(), token, batch)) {
                is IngestReply.Done -> remember(db, settings, batch, reply)
                IngestReply.Unauthorized -> {
                    settings.setNeedsReconnect(true)
                    return
                }
                IngestReply.Retry -> return
            }
        }
    }

    private suspend fun remember(
        db: DepositDatabase,
        settings: DeviceSettings,
        batch: List<PendingDeposit>,
        reply: IngestReply.Done,
    ) {
        val byKey = batch.associateBy { it.dedupeKey }
        db.pending().deleteKeys(reply.items.map { it.dedupeKey })
        val now = System.currentTimeMillis()
        for (item in reply.items) {
            val row = byKey[item.dedupeKey] ?: continue
            db.sent().insert(
                SentDeposit(
                    dedupeKey = row.dedupeKey,
                    receivedAt = row.receivedAt,
                    amountLabel = row.amountLabel,
                    depositorName = row.depositorName,
                    resultLabel = resultLabel(item.result),
                    createdAt = now,
                ),
            )
        }
        db.sent().prune()
        settings.markSent(now)
        settings.setNeedsReconnect(false)
    }
}
