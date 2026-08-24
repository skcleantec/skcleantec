package com.cbiseo.app.auth

import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.drawable.BitmapDrawable
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.cbiseo.app.R
import com.cbiseo.app.session.StaffRoleResolver
import com.cbiseo.app.web.StaffWebActivity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 앱 시작 — 1번 스플래시 이미지 전체 화면 */
class SplashActivity : AppCompatActivity() {
    private val tokenStore by lazy { TokenStore.get(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)
        applySplashBackground()

        lifecycleScope.launch {
            delay(SPLASH_MIN_MS)
            routeNext()
        }
    }

    private fun applySplashBackground() {
        val bitmap = BitmapFactory.decodeResource(resources, R.drawable.splash_screen_bg) ?: return
        val drawable = BitmapDrawable(resources, bitmap)
        findViewById<android.view.View>(android.R.id.content).background = drawable
        window.setBackgroundDrawable(drawable.constantState?.newDrawable()?.mutate())
    }

    private fun routeNext() {
        val token = tokenStore.getToken()
        val role = tokenStore.getRole()
        val target = if (!token.isNullOrBlank() && StaffRoleResolver.homePathForRole(role) != null) {
            StaffWebActivity::class.java
        } else {
            LoginActivity::class.java
        }
        startActivity(Intent(this, target))
        finish()
        @Suppress("DEPRECATION")
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
    }

    companion object {
        private const val SPLASH_MIN_MS = 800L
    }
}
