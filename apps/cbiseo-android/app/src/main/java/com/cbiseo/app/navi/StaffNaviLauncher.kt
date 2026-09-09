package com.cbiseo.app.navi

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/** 팀장 접수 상세 길안내 — WebView가 아닌 네이티브 Intent로 카카오내비·TMAP을 연다 */
object StaffNaviLauncher {
    const val KAKAO_NAVI_PKG = "com.locnall.KimGiSa"
    const val TMAP_PKG = "com.skt.tmap.ku"
    const val TMAP_PKG_LEGACY = "com.skt.skaf.l001mtm091"

    fun open(activity: Activity, app: String, latRaw: String, lngRaw: String, nameRaw: String) {
        val lat = latRaw.toDoubleOrNull()
        val lng = lngRaw.toDoubleOrNull()
        if (lat == null || lng == null) {
            Toast.makeText(activity, "현장 좌표가 없습니다.", Toast.LENGTH_SHORT).show()
            return
        }
        val name = nameRaw.ifBlank { "현장" }
        val useTmap = app.equals("tmap", ignoreCase = true)
        val pkg = if (useTmap) TMAP_PKG else KAKAO_NAVI_PKG
        val uri =
            if (useTmap) {
                Uri.Builder()
                    .scheme("tmap")
                    .authority("route")
                    .appendQueryParameter("referrer", "com.skt.Tmap")
                    .appendQueryParameter("goalx", lng.toString())
                    .appendQueryParameter("goaly", lat.toString())
                    .appendQueryParameter("goalname", name)
                    .build()
            } else {
                Uri.Builder()
                    .scheme("kakaonavi")
                    .authority("navigate")
                    .appendQueryParameter("name", name)
                    .appendQueryParameter("x", lng.toString())
                    .appendQueryParameter("y", lat.toString())
                    .appendQueryParameter("coord_type", "wgs84")
                    .build()
            }

        /** 패키지 고정 없이 먼저 — 깔린 TMAP이 받음. 구글지도 폴백 없음 */
        val naviAny =
            Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        if (startQuietly(activity, naviAny)) return

        val naviPkg =
            Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage(pkg)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        if (startQuietly(activity, naviPkg)) return

        if (useTmap) {
            val legacy =
                Intent(Intent.ACTION_VIEW, uri).apply {
                    setPackage(TMAP_PKG_LEGACY)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            if (startQuietly(activity, legacy)) return
        }

        Toast.makeText(activity, "내비 앱을 열 수 없습니다.", Toast.LENGTH_SHORT).show()
        startQuietly(
            activity,
            Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    private fun startQuietly(activity: Activity, intent: Intent): Boolean {
        return try {
            activity.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }
}
