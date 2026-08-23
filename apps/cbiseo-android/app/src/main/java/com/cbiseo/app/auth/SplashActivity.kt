package com.cbiseo.app.auth

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.cbiseo.app.session.StaffRoleResolver
import com.cbiseo.app.web.StaffWebActivity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 앱 시작 — 1번 스플래시 이미지 전체 화면 (Android 12+ 시스템 아이콘 스플래시 숨김) */
class SplashActivity : AppCompatActivity() {
    private val tokenStore by lazy { TokenStore.get(this) }
    private var keepSystemSplash = true

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { keepSystemSplash }
        super.onCreate(savedInstanceState)
        setContentView(com.cbiseo.app.R.layout.activity_splash)

        lifecycleScope.launch {
            delay(SPLASH_MIN_MS)
            keepSystemSplash = false
            routeNext()
        }
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
        private const val SPLASH_MIN_MS = 600L
    }
}
