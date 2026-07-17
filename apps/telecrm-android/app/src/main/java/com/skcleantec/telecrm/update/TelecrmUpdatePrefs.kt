package com.skcleantec.telecrm.update

import android.content.Context
import androidx.core.content.edit

object TelecrmUpdatePrefs {
    private const val PREFS = "telecrm_update"
    private const val KEY_LAST_CHECK_MS = "last_check_ms"
    private const val CHECK_INTERVAL_MS = 24L * 60 * 60 * 1000

    fun shouldCheckToday(context: Context): Boolean {
        val last = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getLong(KEY_LAST_CHECK_MS, 0L)
        return System.currentTimeMillis() - last >= CHECK_INTERVAL_MS
    }

    fun markChecked(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit {
            putLong(KEY_LAST_CHECK_MS, System.currentTimeMillis())
        }
    }
}
