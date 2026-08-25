package com.cbiseo.app.push

import android.content.Context

/** FCM 토큰 로컬 캐시 — onNewToken·prefetch 저장 (Firebase 권장: 토큰은 비동기 도착) */
object StaffPushTokenCache {
    private const val PREFS = "cbiseo_staff_push_cache"
    private const val KEY_FCM = "fcm_token"
    private const val KEY_UPDATED_AT = "fcm_updated_at"

    fun save(context: Context, token: String) {
        val trimmed = token.trim()
        if (trimmed.length < 20) return
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_FCM, trimmed)
            .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
            .commit()
    }

    fun get(context: Context): String? =
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_FCM, null)
            ?.trim()
            ?.takeIf { it.length >= 20 }

    fun clear(context: Context) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply()
    }
}
