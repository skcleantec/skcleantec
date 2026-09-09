package com.cbiseo.app.navi

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/**
 * Flutter `launchUrl`과 동일한 방식.
 * 참고: https://hanarotg.tistory.com/365
 *
 * Android TMAP:
 * `tmap://route?referrer=com.skt.Tmap&goalx={경도}&goaly={위도}&goalname={이름}`
 * 패키지 고정·resolveActivity 가드 없음 (있으면 깔린 TMAP을 못 찾음).
 */
object StaffNaviLauncher {
    const val KAKAO_NAVI_PKG = "com.locnall.KimGiSa"
    const val TMAP_PKG = "com.skt.tmap.ku"
    const val TMAP_PLAY = "https://play.google.com/store/apps/details?id=$TMAP_PKG&hl=ko-KR"

    fun open(activity: Activity, app: String, latRaw: String, lngRaw: String, nameRaw: String) {
        val lat = latRaw.toDoubleOrNull()
        val lng = lngRaw.toDoubleOrNull()
        if (lat == null || lng == null) {
            Toast.makeText(activity, "현장 좌표가 없습니다.", Toast.LENGTH_SHORT).show()
            return
        }
        val name = nameRaw.ifBlank { "현장" }
        if (app.equals("tmap", ignoreCase = true)) {
            openTmapLikeLaunchUrl(activity, lat, lng, name)
            return
        }
        openKakaoNaviLikeLaunchUrl(activity, lat, lng, name)
    }

    /** 글의 `launchUrl(Uri.parse(tmapURL))` 와 동일 */
    fun openTmapLikeLaunchUrl(activity: Activity, lat: Double, lng: Double, name: String) {
        val uri =
            Uri.Builder()
                .scheme("tmap")
                .authority("route")
                .appendQueryParameter("referrer", "com.skt.Tmap")
                .appendQueryParameter("goalx", lng.toString())
                .appendQueryParameter("goaly", lat.toString())
                .appendQueryParameter("goalname", name)
                .build()
        try {
            activity.startActivity(
                Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        } catch (_: ActivityNotFoundException) {
            activity.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse(TMAP_PLAY)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }

    private fun openKakaoNaviLikeLaunchUrl(activity: Activity, lat: Double, lng: Double, name: String) {
        val uri =
            Uri.Builder()
                .scheme("kakaonavi")
                .authority("navigate")
                .appendQueryParameter("name", name)
                .appendQueryParameter("x", lng.toString())
                .appendQueryParameter("y", lat.toString())
                .appendQueryParameter("coord_type", "wgs84")
                .build()
        try {
            activity.startActivity(
                Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        } catch (_: ActivityNotFoundException) {
            activity.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$KAKAO_NAVI_PKG"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }
}
