package com.cbiseo.depositalert.sms

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat
import com.cbiseo.depositalert.store.DeviceSettings
import com.cbiseo.depositalert.store.NoticeLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** 삼성 메시지·Google 메시지 알림만 읽는다. 다른 앱 알림은 보지 않는다. */
class MessageNoticeReader : NotificationListenerService() {
    private val gate = Mutex()
    private val io = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onListenerConnected() {
        instance = this
        connected = true
        readActive()
    }

    override fun onListenerDisconnected() {
        if (instance === this) instance = null
        connected = false
        requestRebind(ComponentName(this, MessageNoticeReader::class.java))
        DeviceSettings(this).noteNoticeRebind()
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        connected = false
        super.onDestroy()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        accept(sbn, posted = true, rescan = false, journal = true)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        accept(sbn, posted = false, rescan = true, journal = true)
    }

    private fun readActive() {
        val active = try {
            activeNotifications
        } catch (_: Exception) {
            null
        } ?: return
        for (sbn in active) accept(sbn, posted = false, rescan = true, journal = false)
    }

    private fun accept(sbn: StatusBarNotification, posted: Boolean, rescan: Boolean, journal: Boolean) {
        if (sbn.packageName !in MESSAGE_NOTICE_PACKAGES) return
        val settings = DeviceSettings(this)
        if (!settings.listening() || !settings.messageNotice()) return
        val notice = sbn.notification ?: return
        val draft = draftOf(sbn.packageName, notice)
        val pieces = collectNoticePieces(draft)
        val letters = noticeMethodLetters(draft)
        Log.i("DepositAlert", "notice methods=$letters pieces=${pieces.size}")
        val appContext = applicationContext
        val receivedAt = notice.`when`.takeIf { it > 0L } ?: sbn.postTime
        val missed = noticeMissedBank(pieces)
        val depositPieces = pieces.count { dropReason(it.text) == null }
        io.launch {
            gate.withLock {
                val store = DeviceSettings(appContext)
                if (posted) store.noteNoticePost(receivedAt)
                val source = if (rescan) IntakeSource.NoticeRescan else IntakeSource.Notice
                val outcomes = ArrayList<IntakeOutcome>(pieces.size)
                for (piece in pieces) {
                    outcomes.add(
                        DepositIntake.accept(
                            appContext,
                            piece.sender,
                            piece.text,
                            piece.receivedAtMillis,
                            source,
                            piece.summary,
                            countDup = journal,
                        ),
                    )
                }
                val recovered = outcomes.any { it == IntakeOutcome.Queued }
                if (journal || recovered) {
                    store.noteNoticeExtracted(pieces.size)
                    if (missed) store.noteNoticeMissed()
                    store.noteNoticeDeposits(depositPieces)
                    val result = classifyNoticeRecord(pieces.size, outcomes, missed)
                    val shownAt = if (receivedAt > 0L) receivedAt else System.currentTimeMillis()
                    NoticeLog(appContext).add(shownAt, pieces.size, result)
                    Log.i("DepositAlert", "notice lines=${pieces.size} result=${noticeResultCode(result)}")
                }
            }
        }
    }

    companion object {
        @Volatile
        var connected: Boolean = false

        @Volatile
        private var instance: MessageNoticeReader? = null

        fun accessEnabled(context: Context): Boolean {
            val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
                ?: return false
            val name = ComponentName(context, MessageNoticeReader::class.java)
            return flat.contains(name.flattenToString()) || flat.contains(name.flattenToShortString())
        }

        fun maintain(context: Context) {
            val settings = DeviceSettings(context)
            val service = instance
            when (
                chooseMaintain(
                    listening = settings.listening(),
                    messageNotice = settings.messageNotice(),
                    accessEnabled = accessEnabled(context),
                    listenerConnected = connected,
                    listenerBound = service != null,
                )
            ) {
                MaintainChoice.Skip -> return
                MaintainChoice.Rebind -> {
                    requestRebind(ComponentName(context, MessageNoticeReader::class.java))
                    settings.noteNoticeRebind()
                    Log.i("DepositAlert", "notice rebind")
                }
                MaintainChoice.Rescan -> {
                    service?.readActive()
                    Log.i("DepositAlert", "notice rescan")
                }
            }
        }
    }
}

private fun draftOf(packageName: String, notice: Notification): NoticeDraft {
    val extras = notice.extras
    val style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(notice)
    return NoticeDraft(
        packageName = packageName,
        summary = (notice.flags and Notification.FLAG_GROUP_SUMMARY) != 0,
        title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty(),
        whenMillis = notice.`when`,
        messaging = style?.messages.orEmpty().map { it.toLine() },
        historic = style?.historicMessages.orEmpty().map { it.toLine() },
        bundles = bundleLines(extras),
        lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.map { it.toString() }.orEmpty(),
        bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
        text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
    )
}

@Suppress("DEPRECATION")
private fun NotificationCompat.MessagingStyle.Message.toLine(): NoticeLine {
    val who = person?.name?.toString().orEmpty().ifBlank { sender?.toString().orEmpty() }
    return NoticeLine(who, text?.toString().orEmpty(), timestamp)
}

@Suppress("DEPRECATION")
private fun bundleLines(extras: Bundle): List<NoticeLine> {
    val raw = extras.getParcelableArray(Notification.EXTRA_MESSAGES) ?: return emptyList()
    val lines = ArrayList<NoticeLine>()
    for (item in raw) {
        val bundle = item as? Bundle ?: continue
        lines.add(
            NoticeLine(
                sender = bundle.getCharSequence("sender")?.toString().orEmpty(),
                text = bundle.getCharSequence("text")?.toString().orEmpty(),
                timestampMillis = bundle.getLong("time"),
            ),
        )
    }
    return lines
}
