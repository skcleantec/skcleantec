package com.skcleantec.telecrm.update

/** GET /api/public/telecrm-app/manifest */
data class TelecrmAppManifest(
    val latestVersionCode: Int,
    val latestVersionName: String,
    val minVersionCode: Int,
    val downloadUrl: String,
    val releaseNotes: String?,
    val sha256: String?,
) {
    fun isForceUpdate(currentVersionCode: Int): Boolean =
        currentVersionCode < minVersionCode

    fun isUpdateAvailable(currentVersionCode: Int): Boolean =
        downloadUrl.isNotBlank() && currentVersionCode < latestVersionCode
}
