package com.skcleantec.telecrm.update

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

object TelecrmApkDownload {
    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.MINUTES)
        .writeTimeout(10, TimeUnit.MINUTES)
        .build()

    fun updateApkFile(context: Context): File {
        val dir = File(context.cacheDir, "updates").apply { mkdirs() }
        return File(dir, "telecrm-update.apk")
    }

    fun download(context: Context, manifest: TelecrmAppManifest): Result<File> = runCatching {
        val url = manifest.downloadUrl.trim()
        if (url.isBlank()) throw IllegalStateException("다운로드 주소가 없습니다.")

        val outFile = updateApkFile(context)
        if (outFile.exists()) outFile.delete()

        val request = Request.Builder().url(url).get().build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("APK 다운로드 실패 (${response.code})")
            }
            val body = response.body ?: throw IllegalStateException("다운로드 본문이 비어 있습니다.")
            body.byteStream().use { input ->
                outFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        }

        manifest.sha256?.let { expected ->
            val actual = sha256Hex(outFile)
            if (!actual.equals(expected, ignoreCase = true)) {
                outFile.delete()
                throw IllegalStateException("파일 검증에 실패했습니다. SHA256이 일치하지 않습니다.")
            }
        }
        outFile
    }

    private fun sha256Hex(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
