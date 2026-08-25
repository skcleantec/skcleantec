package com.cbiseo.app.web

import android.view.View
import android.webkit.WebView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.appcompat.app.AppCompatActivity

/**
 * WebView 업무 화면 — 콘텐츠가 3버튼/제스처 내비게이션 바 **위**에서 끝나도록.
 * CSS `position:fixed`는 Galaxy WebView에서 viewport가 풀스크린인 경우가 있어 `--cbiseo-safe-area-bottom`도 주입.
 */
object StaffWindowInsets {
    fun apply(activity: AppCompatActivity, root: View, webView: WebView, onBottomPx: (Int) -> Unit) {
        WindowCompat.setDecorFitsSystemWindows(activity.window, true)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, 0, 0, 0)
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
