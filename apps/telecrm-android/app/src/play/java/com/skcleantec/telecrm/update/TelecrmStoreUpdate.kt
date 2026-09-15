package com.skcleantec.telecrm.update

import androidx.appcompat.app.AppCompatActivity
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/** Play 스토어 설치본 — 새 버전이 있으면 필수(IMMEDIATE) 업데이트. */
object TelecrmStoreUpdate {
    const val REQUEST_IMMEDIATE = 7101
    const val PLAY_STORE_URL =
        "https://play.google.com/store/apps/details?id=com.cbiseo.marketer"

    suspend fun startImmediateIfAvailable(activity: AppCompatActivity): TelecrmPlayUpdateStart =
        suspendCancellableCoroutine { cont ->
            val manager = AppUpdateManagerFactory.create(activity)
            manager.appUpdateInfo
                .addOnSuccessListener { info ->
                    val available =
                        info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE ||
                            info.updateAvailability() ==
                            UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
                    if (!available) {
                        if (cont.isActive) cont.resume(TelecrmPlayUpdateStart.None)
                        return@addOnSuccessListener
                    }
                    if (info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                        @Suppress("DEPRECATION")
                        val started = runCatching {
                            manager.startUpdateFlowForResult(
                                info,
                                AppUpdateType.IMMEDIATE,
                                activity,
                                REQUEST_IMMEDIATE,
                            )
                        }.getOrDefault(false)
                        if (cont.isActive) {
                            cont.resume(
                                if (started) {
                                    TelecrmPlayUpdateStart.ImmediateStarted
                                } else {
                                    TelecrmPlayUpdateStart.StoreRequired
                                },
                            )
                        }
                        return@addOnSuccessListener
                    }
                    if (cont.isActive) cont.resume(TelecrmPlayUpdateStart.StoreRequired)
                }
                .addOnFailureListener {
                    if (cont.isActive) cont.resume(TelecrmPlayUpdateStart.None)
                }
        }

    fun resumeIfInProgress(activity: AppCompatActivity) {
        val manager = AppUpdateManagerFactory.create(activity)
        manager.appUpdateInfo.addOnSuccessListener { info ->
            if (info.updateAvailability() !=
                UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
            ) {
                return@addOnSuccessListener
            }
            if (!info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) return@addOnSuccessListener
            @Suppress("DEPRECATION")
            manager.startUpdateFlowForResult(
                info,
                AppUpdateType.IMMEDIATE,
                activity,
                REQUEST_IMMEDIATE,
            )
        }
    }
}
