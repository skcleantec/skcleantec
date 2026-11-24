package com.cbiseo.depositalert.net

import org.json.JSONObject

data class HeartbeatSnapshot(
    val appVersion: String,
    val listenerConnected: Boolean,
    val noticeAccessEnabled: Boolean,
    val keepAliveRunning: Boolean,
    val batteryUnrestricted: Boolean,
    val lastNoticeAt: Long,
    val posts: Int,
    val extracted: Int,
    val deposits: Int,
    val missed: Int,
    val rebinds: Int,
    val sent: Int,
)

/** 서버가 모르는 칸은 무시한다. 문자 본문·잔액·토큰은 넣지 않는다. */
fun heartbeatBody(shot: HeartbeatSnapshot): String {
    val counters = JSONObject()
        .put("posts", shot.posts)
        .put("extracted", shot.extracted)
        .put("deposits", shot.deposits)
        .put("missed", shot.missed)
        .put("rebinds", shot.rebinds)
        .put("sent", shot.sent)
    return JSONObject()
        .put("appVersion", shot.appVersion)
        .put("listenerConnected", shot.listenerConnected)
        .put("noticeAccessEnabled", shot.noticeAccessEnabled)
        .put("keepAliveRunning", shot.keepAliveRunning)
        .put("batteryUnrestricted", shot.batteryUnrestricted)
        .put("lastNoticeAt", shot.lastNoticeAt)
        .put("counters", counters)
        .toString()
}
