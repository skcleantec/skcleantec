package com.cbiseo.depositalert.net

import com.cbiseo.depositalert.service.KEEP_ALIVE_TYPE
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
    val alreadySent: Int = 0,
    val otherPath: Int = 0,
    val withdrawal: Int = 0,
    val noAmount: Int = 0,
    val notNh: Int = 0,
    val noText: Int = 0,
    val balance: Int = 0,
    val hiddenLost: Int = 0,
    val lastHiddenLostAt: Long = 0L,
    val keepAliveType: String = KEEP_ALIVE_TYPE,
    val lastExitReason: String = "",
    val lastExitAt: Long = 0L,
    val restarts: Int = 0,
    val fgsTimeoutCount: Int = 0,
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
        .put("alreadySent", shot.alreadySent)
        .put("otherPath", shot.otherPath)
        .put("withdrawal", shot.withdrawal)
        .put("noAmount", shot.noAmount)
        .put("notNh", shot.notNh)
        .put("noText", shot.noText)
        .put("balance", shot.balance)
        .put("hiddenLost", shot.hiddenLost)
    return JSONObject()
        .put("appVersion", shot.appVersion)
        .put("listenerConnected", shot.listenerConnected)
        .put("noticeAccessEnabled", shot.noticeAccessEnabled)
        .put("keepAliveRunning", shot.keepAliveRunning)
        .put("batteryUnrestricted", shot.batteryUnrestricted)
        .put("lastNoticeAt", shot.lastNoticeAt)
        .put("lastHiddenLostAt", shot.lastHiddenLostAt)
        .put("keepAliveType", shot.keepAliveType)
        .put("lastExitReason", shot.lastExitReason)
        .put("lastExitAt", shot.lastExitAt)
        .put("restarts", shot.restarts)
        .put("fgsTimeoutCount", shot.fgsTimeoutCount)
        .put("counters", counters)
        .toString()
}
