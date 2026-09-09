package com.cbiseo.app.navi

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/**
 * TMAP — [Flutter 티맵 호출](https://hanarotg.tistory.com/365) 과 동일.
 *
 * Android: `tmap://route?referrer=com.skt.Tmap&goalx=경도&goaly=위도&goalname=이름`
 * 실패 시 Play `com.skt.tmap.ku`
 * queries: `com.skt.tmap.ku`, `com.skt.skaf.l001mtm091`
 */
object StaffNaviLauncher {
    const val KAKAO_NAVI_PKG = "com.locnall.KimGiSa"
    const val TMAP_PKG = "com.skt.tmap.ku"
    const val TMAP_PKG_LEGACY = "com.skt.skaf.l001mtm091"
    private const val TMAP_REFERRER = "com.skt.Tmap"

    fun open(activity: Activity, app: String, latRaw: String, lngRaw: String, nameRaw: String) {
        val lat = latRaw.toDoubleOrNull()
        val lng = lngRaw.toDoubleOrNull()
        if (lat == null || lng == null) {
            Toast.makeText(activity, "현장 좌표가 없습니다.", Toast.LENGTH_SHORT).show()
            return
        }
        val name = nameRaw.ifBlank { "현장" }
        if (app.equals("tmap", ignoreCase = true)) {
            if (openTmapLikeFlutter(activity, lat, lng, name)) return
            startQuietly(activity, playStore(TMAP_PKG))
            return
        }
        if (openKakaoNavi(activity, lat, lng, name)) return
        startQuietly(activity, playStore(KAKAO_NAVI_PKG))
    }

    /** Flutter `launchUrl(Uri.parse(tmapURL))` 과 같은 Intent */
    fun openTmapLikeFlutter(activity: Activity, lat: Double, lng: Double, name: String): Boolean {
        val uri =
            Uri.Builder()
                .scheme("tmap")
                .authority("route")
                .appendQueryParameter("referrer", TMAP_REFERRER)
                .appendQueryParameter("goalx", lng.toString())
                .appendQueryParameter("goaly", lat.toString())
                .appendQueryParameter("goalname", name)
                .build()
        val intent =
            Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        return startQuietly(activity, intent)
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
