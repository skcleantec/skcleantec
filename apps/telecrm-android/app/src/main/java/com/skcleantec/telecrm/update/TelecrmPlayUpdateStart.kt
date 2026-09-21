package com.skcleantec.telecrm.update

/** Play flavor 인앱 업데이트 시작 결과. sideload는 항상 [None]. */
enum class TelecrmPlayUpdateStart {
    None,
    ImmediateStarted,
    StoreRequired,
}
