package com.skcleantec.telecrm.update

import com.skcleantec.telecrm.BuildConfig

/** Play flavor: sideload APK 업데이트·REQUEST_INSTALL_PACKAGES 비활성 */
object TelecrmDistribution {
    val sideloadUpdateEnabled: Boolean
        get() = BuildConfig.ENABLE_SIDELOAD_UPDATE
}
