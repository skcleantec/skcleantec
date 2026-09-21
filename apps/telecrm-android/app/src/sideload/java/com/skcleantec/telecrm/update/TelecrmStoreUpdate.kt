package com.skcleantec.telecrm.update

import androidx.appcompat.app.AppCompatActivity

/** sideload APK — Play 인앱 업데이트 없음. */
object TelecrmStoreUpdate {
    const val REQUEST_IMMEDIATE = 7101
    const val PLAY_STORE_URL =
        "https://play.google.com/store/apps/details?id=com.cbiseo.marketer"

    @Suppress("UNUSED_PARAMETER")
    suspend fun startImmediateIfAvailable(activity: AppCompatActivity): TelecrmPlayUpdateStart =
        TelecrmPlayUpdateStart.None

    @Suppress("UNUSED_PARAMETER")
    fun resumeIfInProgress(activity: AppCompatActivity) = Unit
}
