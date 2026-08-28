package com.cbiseo.app.web

import android.view.View
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.cbiseo.app.ui.CbiseoEdgeToEdge

/**
 * WebView 업무·로그인 화면 — edge-to-edge + 하단 내비게이션 바 인셋.
 * CSS `position:fixed`는 Galaxy WebView에서 viewport가 풀스크린인 경우가 있어 `--cbiseo-safe-area-bottom`도 주입.
 */
object StaffWindowInsets {
    fun applyLogin(activity: AppCompatActivity, root: View, webView: WebView, onBottomPx: (Int) -> Unit) {
        CbiseoEdgeToEdge.enableLogin(activity)
        applyWebInsets(activity, root, webView, applyTopPadding = true, onBottomPx)
    }

    fun applyStaffWeb(activity: AppCompatActivity, root: View, webView: WebView, onBottomPx: (Int) -> Unit) {
        CbiseoEdgeToEdge.enableDefault(activity)
        applyWebInsets(activity, root, webView, applyTopPadding = false, onBottomPx)
    }

    private fun applyWebInsets(
        activity: AppCompatActivity,
        root: View,
        webView: WebView,
        applyTopPadding: Boolean,
        onBottomPx: (Int) -> Unit,
    ) {
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, if (applyTopPadding) bars.top else 0, 0, 0)
            val bottomPx = resolveNavigationBarPx(activity, bars.bottom)
            onBottomPx(bottomPx)
            injectSafeAreaCss(webView, bottomPx)
            insets
        }
        ViewCompat.requestApplyInsets(root)
    }

    fun injectSafeAreaCss(webView: WebView?, bottomPx: Int) {
        if (webView == null) return
        val density = webView.resources.displayMetrics.density
        val bottomDp = if (density > 0f) bottomPx / density else 0f
        webView.post {
            webView.evaluateJavascript(
                """
                try{
                  document.documentElement.classList.add('cbiseo-staff-app');
                  document.documentElement.style.setProperty('--cbiseo-safe-area-bottom','${bottomDp}px');
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
