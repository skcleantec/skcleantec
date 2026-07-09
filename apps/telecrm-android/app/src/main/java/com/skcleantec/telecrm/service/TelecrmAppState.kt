package com.skcleantec.telecrm.service

/** MainActivity 포그라운드 여부 — 백그라운드 dispatch는 알림·full-screen intent로 처리 */
object TelecrmAppState {
    @Volatile
    var isMainInForeground: Boolean = false
}
