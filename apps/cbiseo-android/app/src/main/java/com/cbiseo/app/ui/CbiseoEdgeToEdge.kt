package com.cbiseo.app.ui

import android.graphics.Color
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Android 15(API 35)+ edge-to-edge — Play Console 「더 넓은 화면」·지원 중단 API 경고 대응.
 * `android:statusBarColor` / `navigationBarColor` 대신 transparent + SystemBarStyle 사용.
 */
object CbiseoEdgeToEdge {
    fun enableDefault(activity: ComponentActivity) {
        activity.enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
    }

    /** 로그인 — 밝은 상단 배경(#B8D9F2), 어두운 상태바 아이콘 */
    fun enableLogin(activity: ComponentActivity) {
        activity.enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
    }

    /** 스플래시·온보딩 — 어두운/컬러 배경 + 밝은 상태바 아이콘 */
    fun enableSplashOrOnboarding(activity: ComponentActivity) {
        activity.enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
    }

    /** 루트 또는 푸터에 시스템 바 인셋 패딩 (XML padding에 더해짐) */
    fun applyPaddingInsets(
        view: View,
        applyTop: Boolean = false,
        applyBottom: Boolean = false,
    ) {
        val baseLeft = view.paddingLeft
        val baseTop = view.paddingTop
        val baseRight = view.paddingRight
        val baseBottom = view.paddingBottom
        ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(
                baseLeft,
                if (applyTop) baseTop + bars.top else baseTop,
                baseRight,
                if (applyBottom) baseBottom + bars.bottom else baseBottom,
            )
            insets
        }
        ViewCompat.requestApplyInsets(view)
    }
}
