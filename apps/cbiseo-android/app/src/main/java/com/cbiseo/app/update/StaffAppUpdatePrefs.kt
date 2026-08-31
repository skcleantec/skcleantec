package com.cbiseo.app.update

import android.content.Context
import java.time.LocalDate
import java.time.ZoneId

/** 하루 1회 Play 업데이트 프로브 (resume) */
object StaffAppUpdatePrefs {
    private const val PREFS = "cbiseo_staff_app_update"
    private const val KEY_LAST_CHECK_YMD = "last_check_ymd"

    fun shouldCheckToday(context: Context): Boolean {
        val today = todayYmd()
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getString(KEY_LAST_CHECK_YMD, null) != today
    }

    fun markChecked(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_CHECK_YMD, todayYmd())
            .apply()
    }

    private fun todayYmd(): String =
        LocalDate.now(ZoneId.of("Asia/Seoul")).toString()
}
