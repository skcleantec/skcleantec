package com.cbiseo.app.navi

import android.app.Activity
import android.content.ActivityNotFoundException
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
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
        try {
            activity.startActivity(navi)
            return
        } catch (_: ActivityNotFoundException) {
            /* 미설치·스킴 거부 → 지도 선택 또는 스토어 */
        }

        val geo =
            Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng(${Uri.encode(name)})")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        try {
            activity.startActivity(geo)
            return
        } catch (_: ActivityNotFoundException) {
            /* 지도 앱 없음 */
        }

        val market =
            Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        try {
            activity.startActivity(market)
        } catch (_: ActivityNotFoundException) {
            activity.startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=$pkg"),
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }
}
