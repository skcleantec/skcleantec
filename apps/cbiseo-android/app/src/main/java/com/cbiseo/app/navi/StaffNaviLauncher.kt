package com.cbiseo.app.navi

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import java.net.URLEncoder

/**
 * TMAP 공식·지원 안내에 맞춘 외부 앱 실행.
 *
 * - Android: `tmap://route?referrer=com.skt.Tmap&goalx=경도&goaly=위도&goalname=이름`
 *   (TMAP 지원이 Flutter 연동에 안내한 형식)
 * - 실사용: `goalname`+`goalx`+`goaly`, 또는 SDK 키 `rGoX`/`rGoY`/`rGoName`
 * - Intent에 `CATEGORY_BROWSABLE` 필수. 없으면 TMAP이 받지 않음.
 * - 패키지: `com.skt.tmap.ku` (현행) · `com.skt.skaf.l001mtm091` (구버전)
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
            if (openTmap(activity, lat, lng, name)) return
            Toast.makeText(activity, "TMAP을 열 수 없습니다.", Toast.LENGTH_SHORT).show()
            startQuietly(
                activity,
                marketIntent(TMAP_PKG),
            )
            return
        }
        if (openKakaoNavi(activity, lat, lng, name)) return
        Toast.makeText(activity, "카카오내비를 열 수 없습니다.", Toast.LENGTH_SHORT).show()
        startQuietly(activity, marketIntent(KAKAO_NAVI_PKG))
    }

    fun openTmap(activity: Activity, lat: Double, lng: Double, name: String): Boolean {
        val encoded = URLEncoder.encode(name, "UTF-8")
        val uris =
            listOf(
                "tmap://route?referrer=$TMAP_REFERRER&goalx=$lng&goaly=$lat&goalname=$encoded",
                "tmap://route?goalname=$encoded&goalx=$lng&goaly=$lat",
                "tmap://route?rGoName=$encoded&rGoX=$lng&rGoY=$lat",
                "tmap://route?goalx=$lng&goaly=$lat&reqCoordType=WGS84&resCoordType=WGS84",
            )
        val packages = listOf(null, TMAP_PKG, TMAP_PKG_LEGACY)
        for (uri in uris) {
            for (pkg in packages) {
                if (startNaviIntent(activity, uri, pkg)) return true
            }
        }
        val launch = activity.packageManager.getLaunchIntentForPackage(TMAP_PKG)
            ?: activity.packageManager.getLaunchIntentForPackage(TMAP_PKG_LEGACY)
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            return startQuietly(activity, launch)
        }
        return false
    }

    private fun openKakaoNavi(activity: Activity, lat: Double, lng: Double, name: String): Boolean {
        val encoded = URLEncoder.encode(name, "UTF-8")
        val uri = "kakaonavi://navigate?name=$encoded&x=$lng&y=$lat&coord_type=wgs84"
        if (startNaviIntent(activity, uri, null)) return true
        return startNaviIntent(activity, uri, KAKAO_NAVI_PKG)
    }

    private fun startNaviIntent(activity: Activity, uri: String, pkg: String?): Boolean {
        val intent =
            Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
                addCategory(Intent.CATEGORY_DEFAULT)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (!pkg.isNullOrBlank()) setPackage(pkg)
            }
        if (activity.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY) == null) {
            return false
        }
        return startQuietly(activity, intent)
    }

    private fun marketIntent(pkg: String): Intent {
        return Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
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
