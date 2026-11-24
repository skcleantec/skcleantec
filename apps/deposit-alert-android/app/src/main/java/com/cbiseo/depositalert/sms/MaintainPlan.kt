package com.cbiseo.depositalert.sms

enum class MaintainChoice { Skip, Rebind, Rescan }

/** 듣기가 꺼져 있으면 건너뛴다. 연결이 없으면 다시 묶고, 있으면 떠 있는 알림을 훑는다. */
fun chooseMaintain(
    listening: Boolean,
    messageNotice: Boolean,
    accessEnabled: Boolean,
    listenerConnected: Boolean,
    listenerBound: Boolean,
): MaintainChoice {
    if (!listening || !messageNotice || !accessEnabled) return MaintainChoice.Skip
    if (!listenerConnected || !listenerBound) return MaintainChoice.Rebind
    return MaintainChoice.Rescan
}

const val KEEP_ALIVE_TICK_MS = 60_000L
const val HEARTBEAT_EVERY_TICKS = 5

/** 1분 살피기 5번마다 한 번 상태를 보낸다. */
fun heartbeatDue(tick: Int): Boolean = tick > 0 && tick % HEARTBEAT_EVERY_TICKS == 0
