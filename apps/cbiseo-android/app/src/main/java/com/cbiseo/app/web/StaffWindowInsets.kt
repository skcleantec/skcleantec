package com.cbiseo.app.web

import android.view.View
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.cbiseo.app.ui.CbiseoEdgeToEdge

/**
 * WebView 업무·로그인 화면 — edge-to-edge + 시스템 바 인셋.
 * CSS `position:fixed`는 Galaxy WebView에서 viewport가 풀스크린인 경우가 있어
 * `--cbiseo-safe-area-bottom` / `--cbiseo-safe-area-top` 을 주입한다.
 * 업무 화면은 네이티브 top padding을 주지 않으므로(GNB가 상태바 아래를 칠함) CSS top만 주입한다.
 */
object StaffWindowInsets {
    fun applyLogin(activity: AppCompatActivity, root: View, webView: WebView, onBottomPx: (Int) -> Unit) {
        CbiseoEdgeToEdge.enableLogin(activity)
        applyWebInsets(activity, root, webView, applyTopPadding = true) { bottomPx, _ ->
            onBottomPx(bottomPx)
        }
    }

    fun applyStaffWeb(
        activity: AppCompatActivity,
        root: View,
        webView: WebView,
        onInsets: (bottomPx: Int, topPx: Int) -> Unit,
    ) {
        CbiseoEdgeToEdge.enableDefault(activity)
        applyWebInsets(activity, root, webView, applyTopPadding = false, onInsets)
    }

    private fun applyWebInsets(
        activity: AppCompatActivity,
        root: View,
        webView: WebView,
        applyTopPadding: Boolean,
        onInsets: (bottomPx: Int, topPx: Int) -> Unit,
    ) {
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, if (applyTopPadding) bars.top else 0, 0, 0)
            val bottomPx = resolveNavigationBarPx(activity, bars.bottom)
            val topPx = if (applyTopPadding) 0 else bars.top
            onInsets(bottomPx, topPx)
            injectSafeAreaCss(webView, bottomPx, topPx)
            insets
        }
        ViewCompat.requestApplyInsets(root)
    }

    fun injectSafeAreaCss(webView: WebView?, bottomPx: Int, topPx: Int = 0) {
        if (webView == null) return
        val density = webView.resources.displayMetrics.density
        val bottomDp = if (density > 0f) bottomPx / density else 0f
        val topDp = if (density > 0f) topPx / density else 0f
        webView.post {
            webView.evaluateJavascript(
                """
                try{
                  document.documentElement.classList.add('cbiseo-staff-app');
                  document.documentElement.style.setProperty('--cbiseo-safe-area-bottom','${bottomDp}px');
                  document.documentElement.style.setProperty('--cbiseo-safe-area-top','${topDp}px');
                }catch(e){}
                """.trimIndent(),
                null,
            )
        }
    }

    private fun resolveNavigationBarPx(activity: AppCompatActivity, insetBottom: Int): Int {
        if (insetBottom > 0) return insetBottom
        val resId = activity.resources.getIdentifier("navigation_bar_height", "dimen", "android")
        return if (resId > 0) activity.resources.getDimensionPixelSize(resId) else 0
    }
}
