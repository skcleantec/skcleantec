package com.cbiseo.depositalert.service

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

fun scheduleWake(context: Context, now: Long = System.currentTimeMillis()) {
    val alarm = context.getSystemService(AlarmManager::class.java) ?: return
    val pending = wakeIntent(context)
    val at = nextWakeAt(now)
    val exact = useExactAlarm(Build.VERSION.SDK_INT < 31 || alarm.canScheduleExactAlarms())
    try {
        if (exact) alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
        else alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
    } catch (_: SecurityException) {
        alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
    }
}

private fun wakeIntent(context: Context): PendingIntent {
    val intent = Intent(context, WakeReceiver::class.java)
    return PendingIntent.getBroadcast(
        context,
        71,
        intent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
}
