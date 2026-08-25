package com.cbiseo.app.auth

import android.content.Context

/** 최초 1회 온보딩 완료 여부 */
object OnboardingPrefs {
    private const val PREFS_NAME = "cbiseo_onboarding"
    private const val KEY_COMPLETED = "completed_v1"

    fun isCompleted(context: Context): Boolean =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_COMPLETED, false)

    fun setCompleted(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_COMPLETED, true)
            .apply()
    }
}
