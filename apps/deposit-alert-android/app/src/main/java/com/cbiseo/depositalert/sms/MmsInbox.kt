package com.cbiseo.depositalert.sms

import android.content.Context
import android.net.Uri
import android.provider.Telephony

/** 멀티미디어 문자함의 제목·본문만 모은다. 그림은 읽지 않는다. */
fun readMmsInbox(context: Context, cutoffMillis: Long): List<InboxLine> {
    val resolver = context.contentResolver
    val lines = ArrayList<InboxLine>()
    val cursor = resolver.query(
        Telephony.Mms.Inbox.CONTENT_URI,
        arrayOf(Telephony.Mms._ID, Telephony.Mms.DATE, Telephony.Mms.SUBJECT),
        null,
        null,
        null,
    ) ?: return lines
    cursor.use {
        val idCol = it.getColumnIndex(Telephony.Mms._ID)
        val dateCol = it.getColumnIndex(Telephony.Mms.DATE)
        val subjectCol = it.getColumnIndex(Telephony.Mms.SUBJECT)
        while (it.moveToNext()) {
            val id = if (idCol >= 0) it.getLong(idCol) else continue
            val receivedAt = mmsDateMillis(if (dateCol >= 0) it.getLong(dateCol) else 0L)
            if (receivedAt < cutoffMillis) continue
            val subject = if (subjectCol >= 0) it.getString(subjectCol).orEmpty() else ""
            val text = mmsScanText(subject, mmsTextParts(context, id))
            if (text.isBlank()) continue
            lines.add(InboxLine(mmsSender(context, id), text, receivedAt))
        }
    }
    return lines
}

private fun mmsSender(context: Context, messageId: Long): String {
    val cursor = context.contentResolver.query(
        Uri.parse("content://mms/addr"),
        arrayOf("address"),
        "msg_id=? AND type=137",
        arrayOf(messageId.toString()),
        null,
    ) ?: return ""
    cursor.use {
        val col = it.getColumnIndex("address")
        if (!it.moveToFirst() || col < 0) return ""
        return it.getString(col).orEmpty()
    }
}

private fun mmsTextParts(context: Context, messageId: Long): List<String> {
    val cursor = context.contentResolver.query(
        Telephony.Mms.Part.CONTENT_URI,
        arrayOf(Telephony.Mms.Part._ID, Telephony.Mms.Part.CONTENT_TYPE, Telephony.Mms.Part.TEXT),
        "${Telephony.Mms.Part.MSG_ID}=?",
        arrayOf(messageId.toString()),
        null,
    ) ?: return emptyList()
    val parts = ArrayList<String>()
    cursor.use {
        val idCol = it.getColumnIndex(Telephony.Mms.Part._ID)
        val typeCol = it.getColumnIndex(Telephony.Mms.Part.CONTENT_TYPE)
        val textCol = it.getColumnIndex(Telephony.Mms.Part.TEXT)
        while (it.moveToNext()) {
            val type = if (typeCol >= 0) it.getString(typeCol).orEmpty() else ""
            if (!type.startsWith("text/") || type.contains("smil")) continue
            val inline = if (textCol >= 0) it.getString(textCol).orEmpty() else ""
            val text = inline.ifBlank {
                val partId = if (idCol >= 0) it.getLong(idCol) else 0L
                if (partId <= 0L) "" else readPartStream(context, partId)
            }
            if (text.isNotBlank()) parts.add(text)
        }
    }
    return parts
}

private fun readPartStream(context: Context, partId: Long): String {
    return try {
        context.contentResolver.openInputStream(Uri.parse("content://mms/part/$partId"))?.use { stream ->
            stream.bufferedReader(Charsets.UTF_8).readText()
        }.orEmpty()
    } catch (_: Exception) {
        ""
    }
}
