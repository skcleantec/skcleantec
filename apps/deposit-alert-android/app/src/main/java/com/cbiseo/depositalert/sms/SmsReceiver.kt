package com.cbiseo.depositalert.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.cbiseo.depositalert.store.DeviceSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** 입금 문자만 다듬어 보낸다. 연락처·통화 기록·다른 앱 알림은 읽지 않는다. */
class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        Log.i("DepositAlert", "sms broadcast")
        if (!DeviceSettings(context).listening()) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isEmpty()) return
        val sender = messages.first().displayOriginatingAddress.orEmpty()
        val body = joinSmsParts(messages.map { it.displayMessageBody.orEmpty() })
        val receivedAt = messages.first().timestampMillis.takeIf { it > 0 } ?: System.currentTimeMillis()
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                DepositIntake.accept(context.applicationContext, sender, body, receivedAt, IntakeSource.Sms)
            } finally {
                pending.finish()
            }
        }
    }
}
