package com.cbiseo.app.update

import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.appcompat.app.AppCompatActivity
import com.cbiseo.app.BuildConfig
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import org.json.JSONObject

/**
 * Google Play In-App Update — 선택 FLEXIBLE, 필수 IMMEDIATE.
 * WebView UI는 [com.cbiseo.app.bridge.CbiseoAppBridge] + 웹 배너.
 */
class StaffAppUpdateCoordinator(
    private val activity: AppCompatActivity,
    private val onStatusChanged: () -> Unit,
) {
    private val appUpdateManager: AppUpdateManager = AppUpdateManagerFactory.create(activity)
    private var cachedStatus: JSONObject = defaultStatusJson()
    private var updateLauncher: ActivityResultLauncher<IntentSenderRequest>? = null

    fun bindUpdateLauncher(launcher: ActivityResultLauncher<IntentSenderRequest>) {
        updateLauncher = launcher
    }

    private val installListener = InstallStateUpdatedListener { state ->
        mergeInstallStatus(state.installStatus())
        notifyChanged()
    }

    init {
        appUpdateManager.registerListener(installListener)
    }

    fun dispose() {
        appUpdateManager.unregisterListener(installListener)
    }

    fun getStatusJson(): String = cachedStatus.toString()

    fun refreshPlayUpdateStatus(markChecked: Boolean = false, onDone: (() -> Unit)? = null) {
        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                if (markChecked) {
                    StaffAppUpdatePrefs.markChecked(activity.applicationContext)
                }
                val available =
                    info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE ||
                        info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
                cachedStatus = buildStatusJson(
                    playUpdateAvailable = available,
                    installStatus = info.installStatus(),
                    allowedFlexible = info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
                    allowedImmediate = info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
                )
                notifyChanged()
                onDone?.invoke()
            }
            .addOnFailureListener {
                onDone?.invoke()
            }
    }

    fun resumeStalledImmediateUpdate(launcher: ActivityResultLauncher<IntentSenderRequest>) {
        appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
            if (info.updateAvailability() != UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) return@addOnSuccessListener
            if (!info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) return@addOnSuccessListener
            appUpdateManager.startUpdateFlowForResult(
                info,
                launcher,
                AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
            )
        }
    }

    fun requestStartUpdate(mode: String) {
        val launcher = updateLauncher
        if (launcher == null) {
            openPlayStore()
            return
        }
        startUpdate(mode, launcher)
    }

    fun startUpdate(
        mode: String,
        launcher: ActivityResultLauncher<IntentSenderRequest>,
    ) {
        val updateType =
            if (mode.equals("immediate", ignoreCase = true)) {
                AppUpdateType.IMMEDIATE
            } else {
                AppUpdateType.FLEXIBLE
            }
        appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
            if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE &&
                info.updateAvailability() != UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
            ) {
                openPlayStore()
                return@addOnSuccessListener
            }
            if (!info.isUpdateTypeAllowed(updateType)) {
                openPlayStore()
                return@addOnSuccessListener
            }
            appUpdateManager.startUpdateFlowForResult(
                info,
                launcher,
                AppUpdateOptions.newBuilder(updateType).build(),
            )
        }.addOnFailureListener {
            openPlayStore()
        }
    }

    fun completeFlexibleUpdate() {
        appUpdateManager.completeUpdate()
    }

    fun openPlayStore() {
        if (activity.isFinishing || activity.isDestroyed) return
        val intent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse(PLAY_STORE_URL),
        )
        runCatching { activity.startActivity(intent) }
    }

    fun onUpdateFlowResult(ok: Boolean) {
        if (!ok) {
            mergeInstallStatus(InstallStatus.UNKNOWN)
            notifyChanged()
        }
    }

    private fun mergeInstallStatus(installStatus: Int) {
        cachedStatus = buildStatusJson(
            playUpdateAvailable = cachedStatus.optBoolean("playUpdateAvailable"),
            installStatus = installStatus,
            allowedFlexible = cachedStatus.optBoolean("allowedFlexible"),
            allowedImmediate = cachedStatus.optBoolean("allowedImmediate"),
        )
    }

    private fun notifyChanged() {
        onStatusChanged()
    }

    private fun buildStatusJson(
        playUpdateAvailable: Boolean,
        installStatus: Int,
        allowedFlexible: Boolean,
        allowedImmediate: Boolean,
    ): JSONObject =
        JSONObject()
            .put("playUpdateAvailable", playUpdateAvailable)
            .put("installStatus", installStatusName(installStatus))
            .put("allowedFlexible", allowedFlexible)
            .put("allowedImmediate", allowedImmediate)
            .put("clientVersionCode", BuildConfig.VERSION_CODE)
            .put("clientVersionName", BuildConfig.VERSION_NAME)

    private fun defaultStatusJson(): JSONObject =
        buildStatusJson(
            playUpdateAvailable = false,
            installStatus = InstallStatus.UNKNOWN,
            allowedFlexible = false,
            allowedImmediate = false,
        )

    private fun installStatusName(code: Int): String =
        when (code) {
            InstallStatus.PENDING -> "PENDING"
            InstallStatus.DOWNLOADING -> "DOWNLOADING"
            InstallStatus.DOWNLOADED -> "DOWNLOADED"
            InstallStatus.INSTALLED -> "INSTALLED"
            InstallStatus.FAILED -> "FAILED"
            InstallStatus.CANCELED -> "CANCELED"
            else -> "UNKNOWN"
        }

    companion object {
        const val PLAY_STORE_URL =
            "https://play.google.com/store/apps/details?id=com.cbiseo.app"
    }
}
