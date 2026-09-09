package com.cbiseo.app.navi

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/** 팀장 접수 상세 길안내 — WebView가 아닌 네이티브 Intent로 카카오내비·TMAP을 연다 */
object StaffNaviLauncher {
    const val KAKAO_NAVI_PKG = "com.locnall.KimGiSa"
    const val TMAP_PKG = "com.skt.tmap.ku"

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
                    .appendQueryParameter("referrer", "com.cbiseo.app")
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

        val navi =
            Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage(pkg)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        if (startQuietly(activity, navi)) return

        val naviAny =
            Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        if (startQuietly(activity, naviAny)) return

        val mapsHttps =
            if (useTmap) {
                "https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving"
            } else {
                "https://map.kakao.com/link/to/${Uri.encode(name)},$lat,$lng"
            }
        if (startQuietly(activity, Intent(Intent.ACTION_VIEW, Uri.parse(mapsHttps)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))) {
            return
        }

        val geo =
            Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng(${Uri.encode(name)})")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        if (startQuietly(activity, geo)) return

        val market =
            Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        if (startQuietly(activity, market)) return
        startQuietly(
            activity,
            Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://play.google.com/store/apps/details?id=$pkg"),
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
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
