package com.cbiseo.app.navi

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/**
 * TMAP 공식 TMapTapi 계약.
 * https://tmapapi.tmapmobility.com/main.html
 * invokeRoute(destName, fX=경도, fY=위도)
 * HashMap 필수: rGoName, rGoX(경도), rGoY(위도) — TMapTapi.h
 *
 * 웹 공식: GET https://apis.openapi.sk.com/tmap/app/routes?appKey&name&lon&lat
 * https://openapi.sk.com/qnaCommunity/398
 */
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
        if (app.equals("tmap", ignoreCase = true)) {
            if (openTmapOfficialTapi(activity, lat, lng, name)) return
            startQuietly(activity, playStore(TMAP_PKG))
            Toast.makeText(activity, "TMAP을 열 수 없어 스토어로 이동합니다.", Toast.LENGTH_SHORT).show()
            return
        }
        if (openKakaoNavi(activity, lat, lng, name)) return
        startQuietly(activity, playStore(KAKAO_NAVI_PKG))
        Toast.makeText(activity, "카카오내비를 열 수 없어 스토어로 이동합니다.", Toast.LENGTH_SHORT).show()
    }

    /** 공식 TMapTapi routeInfo 키를 쿼리로 전달 */
    fun openTmapOfficialTapi(activity: Activity, lat: Double, lng: Double, name: String): Boolean {
        val uri =
            Uri.Builder()
                .scheme("tmap")
                .authority("route")
                .appendQueryParameter("rGoName", name)
                .appendQueryParameter("rGoX", lng.toString())
                .appendQueryParameter("rGoY", lat.toString())
                .build()
        return startQuietly(
            activity,
            Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    private fun openKakaoNavi(activity: Activity, lat: Double, lng: Double, name: String): Boolean {
        val uri =
            Uri.Builder()
                .scheme("kakaonavi")
                .authority("navigate")
                .appendQueryParameter("name", name)
                .appendQueryParameter("x", lng.toString())
                .appendQueryParameter("y", lat.toString())
                .appendQueryParameter("coord_type", "wgs84")
                .build()
        return startQuietly(
            activity,
            Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    private fun playStore(pkg: String): Intent {
        return Intent(
            Intent.ACTION_VIEW,
            Uri.parse("https://play.google.com/store/apps/details?id=$pkg&hl=ko-KR"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
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
