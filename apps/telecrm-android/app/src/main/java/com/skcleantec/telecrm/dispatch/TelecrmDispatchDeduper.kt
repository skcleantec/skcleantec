package com.skcleantec.telecrm.dispatch

/** WS·폴링 동시 수신 시 동일 dispatch id 중복 실행 방지 */
object TelecrmDispatchDeduper {
    private const val MAX_SEEN = 64
    private val seen = LinkedHashSet<String>()

    fun shouldRun(id: String?): Boolean {
        if (id.isNullOrBlank()) return true
        synchronized(this) {
            if (seen.contains(id)) return false
            while (seen.size >= MAX_SEEN) {
                val it = seen.iterator()
                if (!it.hasNext()) break
                it.next()
                it.remove()
            }
            seen.add(id)
            return true
        }
    }
}
