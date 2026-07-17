package com.skcleantec.telecrm.update

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.view.LayoutInflater
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.skcleantec.telecrm.BuildConfig
import com.skcleantec.telecrm.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * 로그인·메인에서 공통으로 쓰는 sideload 업데이트 흐름.
 * 매니페스트: {apiBaseUrl}/api/public/telecrm-app/manifest
 */
object TelecrmUpdateCoordinator {
    private var pendingManifest: TelecrmAppManifest? = null
    private var pendingApiBaseUrl: String? = null
    private var progressDialog: AlertDialog? = null

    suspend fun checkOnLogin(activity: AppCompatActivity, apiBaseUrl: String): Boolean {
        val manifest = fetchManifestOrNull(apiBaseUrl) ?: return false
        TelecrmUpdatePrefs.markChecked(activity)
        val current = BuildConfig.VERSION_CODE
        if (manifest.isForceUpdate(current)) {
            showUpdateDialog(activity, manifest, apiBaseUrl, required = true)
            return true
        }
        if (manifest.isUpdateAvailable(current)) {
            showUpdateDialog(activity, manifest, apiBaseUrl, required = false)
        }
        return false
    }

    suspend fun checkOnMain(activity: AppCompatActivity, apiBaseUrl: String) {
        if (!TelecrmUpdatePrefs.shouldCheckToday(activity)) return
        val manifest = fetchManifestOrNull(apiBaseUrl) ?: return
        TelecrmUpdatePrefs.markChecked(activity)
        val current = BuildConfig.VERSION_CODE
        when {
            manifest.isForceUpdate(current) ->
                showUpdateDialog(activity, manifest, apiBaseUrl, required = true)
            manifest.isUpdateAvailable(current) ->
                showUpdateDialog(activity, manifest, apiBaseUrl, required = false)
        }
    }

    fun checkManually(activity: AppCompatActivity, apiBaseUrl: String) {
        activity.lifecycleScope.launch {
            val manifest = withContext(Dispatchers.IO) {
                TelecrmManifestClient.fetch(apiBaseUrl).getOrNull()
            } ?: run {
                showError(activity, activity.getString(R.string.update_manifest_failed), apiBaseUrl)
                return@launch
            }
            TelecrmUpdatePrefs.markChecked(activity)
            val current = BuildConfig.VERSION_CODE
            when {
                manifest.isForceUpdate(current) || manifest.isUpdateAvailable(current) ->
                    showUpdateDialog(
                        activity,
                        manifest,
                        apiBaseUrl,
                        required = manifest.isForceUpdate(current),
                    )
                else ->
                    showInfo(activity, activity.getString(R.string.update_already_latest))
            }
        }
    }

    fun onInstallPermissionResult(activity: AppCompatActivity) {
        val manifest = pendingManifest ?: return
        if (TelecrmApkInstall.canInstallPackages(activity)) {
            startDownloadAndInstall(activity, manifest, pendingApiBaseUrl.orEmpty())
        }
    }

    private suspend fun fetchManifestOrNull(apiBaseUrl: String): TelecrmAppManifest? =
        withContext(Dispatchers.IO) {
            TelecrmManifestClient.fetch(apiBaseUrl).getOrNull()
        }

    private fun installPageUrl(apiBaseUrl: String): String =
        "${apiBaseUrl.trim().trimEnd('/')}/telecrm-app"

    private fun openInstallPage(activity: Activity, apiBaseUrl: String) {
        if (activity.isFinishing || activity.isDestroyed) return
        activity.startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(installPageUrl(apiBaseUrl))).apply {
                if (activity !is AppCompatActivity) addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }

    fun showInstallBlockedHelp(activity: Activity, apiBaseUrl: String) {
        if (activity.isFinishing || activity.isDestroyed) return
        AlertDialog.Builder(activity)
            .setTitle(R.string.update_install_blocked_title)
            .setMessage(R.string.update_install_blocked_message)
            .setPositiveButton(R.string.open_install_page) { _, _ -> openInstallPage(activity, apiBaseUrl) }
            .setNegativeButton(android.R.string.ok, null)
            .show()
    }

    private fun showUpdateDialog(
        activity: AppCompatActivity,
        manifest: TelecrmAppManifest,
        apiBaseUrl: String,
        required: Boolean,
    ) {
        if (activity.isFinishing || activity.isDestroyed) return
        val message = buildString {
            append(
                activity.getString(
                    if (required) {
                        R.string.update_prompt_message_required
                    } else {
                        R.string.update_prompt_message_optional
                    },
                    manifest.latestVersionName,
                    manifest.latestVersionCode,
                    BuildConfig.VERSION_NAME,
                    BuildConfig.VERSION_CODE,
                ),
            )
            manifest.releaseNotes?.takeIf { it.isNotBlank() }?.let {
                append("\n\n")
                append(it)
            }
        }
        val builder = AlertDialog.Builder(activity)
            .setTitle(
                if (required) R.string.update_required_title else R.string.update_available_title,
            )
            .setMessage(message)
            .setCancelable(!required)
            .setPositiveButton(R.string.update_download_install) { _, _ ->
                pendingManifest = manifest
                pendingApiBaseUrl = apiBaseUrl
                if (!TelecrmApkInstall.canInstallPackages(activity)) {
                    TelecrmApkInstall.openInstallPermissionSettings(activity)
                } else {
                    startDownloadAndInstall(activity, manifest, apiBaseUrl)
                }
            }
            .setNeutralButton(R.string.open_install_page) { _, _ ->
                openInstallPage(activity, apiBaseUrl)
            }
        if (required) {
            builder.setNegativeButton(R.string.update_install_help) { _, _ ->
                showInstallBlockedHelp(activity, apiBaseUrl)
            }
        } else {
            builder.setNegativeButton(R.string.update_later, null)
        }
        builder.show()
    }

    private fun startDownloadAndInstall(
        activity: AppCompatActivity,
        manifest: TelecrmAppManifest,
        apiBaseUrl: String,
    ) {
        activity.lifecycleScope.launch {
            showProgress(activity, activity.getString(R.string.update_downloading))
            val result = withContext(Dispatchers.IO) {
                TelecrmApkDownload.download(activity.applicationContext, manifest)
            }
            dismissProgress()
            result.onSuccess { apk ->
                pendingManifest = null
                pendingApiBaseUrl = null
                TelecrmApkInstall.installApk(activity, apk)
            }.onFailure { err ->
                showError(
                    activity,
                    err.message ?: activity.getString(R.string.update_download_failed),
                    apiBaseUrl,
                )
            }
        }
    }

    private fun showProgress(activity: Activity, message: String) {
        dismissProgress()
        val view = LayoutInflater.from(activity).inflate(R.layout.dialog_update_progress, null)
        view.findViewById<TextView>(R.id.updateProgressMessage).text = message
        progressDialog = AlertDialog.Builder(activity)
            .setView(view)
            .setCancelable(false)
            .create()
            .also { it.show() }
    }

    private fun dismissProgress() {
        progressDialog?.dismiss()
        progressDialog = null
    }

    private fun showError(activity: Activity, message: String, apiBaseUrl: String) {
        if (activity.isFinishing || activity.isDestroyed) return
        AlertDialog.Builder(activity)
            .setTitle(R.string.update_error_title)
            .setMessage(message)
            .setPositiveButton(android.R.string.ok, null)
            .setNeutralButton(R.string.update_install_help) { _, _ ->
                showInstallBlockedHelp(activity, apiBaseUrl)
            }
            .show()
    }

    private fun showInfo(activity: Activity, message: String) {
        if (activity.isFinishing || activity.isDestroyed) return
        AlertDialog.Builder(activity)
            .setTitle(R.string.update_available_title)
            .setMessage(message)
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }
}
