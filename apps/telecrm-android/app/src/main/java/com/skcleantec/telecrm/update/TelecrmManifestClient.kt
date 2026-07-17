package com.skcleantec.telecrm.update

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object TelecrmManifestClient {
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    fun manifestUrl(apiBaseUrl: String): String =
        "${apiBaseUrl.trim().trimEnd('/')}/api/public/telecrm-app/manifest"

    fun fetch(apiBaseUrl: String): Result<TelecrmAppManifest> = runCatching {
        val request = Request.Builder()
            .url(manifestUrl(apiBaseUrl))
            .get()
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException("업데이트 정보를 불러오지 못했습니다. (${response.code})")
            }
            parse(JSONObject(raw))
        }
    }

    private fun parse(json: JSONObject): TelecrmAppManifest =
        TelecrmAppManifest(
            latestVersionCode = json.getInt("latestVersionCode"),
            latestVersionName = json.optString("latestVersionName", ""),
            minVersionCode = json.getInt("minVersionCode"),
            downloadUrl = json.optString("downloadUrl", ""),
            releaseNotes = json.optString("releaseNotes").takeIf { it.isNotBlank() },
            sha256 = json.optString("sha256").takeIf { it.isNotBlank() },
        )
}
