package com.cbiseo.app.push

import android.content.Intent
import com.cbiseo.app.web.StaffWebActivity

/** FCM 알림 탭 시 intent extras에서 path 추출 */
object StaffPushIntentExtras {
    fun pushPathFrom(intent: Intent?): String? {
        if (intent == null) return null
        return intent.getStringExtra(StaffWebActivity.EXTRA_PUSH_PATH)
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: intent.getStringExtra("path")
                ?.trim()
                ?.takeIf { it.isNotBlank() }
    }
}
