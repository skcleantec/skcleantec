package com.cbiseo.app.auth

import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.drawable.BitmapDrawable
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.cbiseo.app.R
import com.cbiseo.app.push.StaffFcmRegistrar
import com.cbiseo.app.push.StaffPushIntentExtras
import com.cbiseo.app.push.StaffNotificationPermission
import com.cbiseo.app.session.StaffRoleResolver
import com.cbiseo.app.web.StaffWebActivity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 앱 시작 — 스플래시 후 권한(필요 시) → 로그인 또는 업무 WebView */
class SplashActivity : AppCompatActivity() {
    private val tokenStore by lazy { TokenStore.get(this) }
    private var routed = false
    private var minDelayElapsed = false
    private var permissionFlowSettled = false

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { _ ->
        permissionFlowSettled = true
        maybeRegisterPushIfLoggedIn()
        tryRouteNext()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)
        applySplashBackground()

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            StaffNotificationPermission.isGranted(this)
        ) {
            permissionFlowSettled = true
        }

        lifecycleScope.launch {
            delay(SPLASH_MIN_MS)
            minDelayElapsed = true
            tryRouteNext()
        }
    }

    override fun onPostResume() {
        super.onPostResume()
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            StaffNotificationPermission.isGranted(this)
        ) {
            permissionFlowSettled = true
            tryRouteNext()
            return
        }
        val alreadyPrompted = StaffNotificationPermission.hasPromptedThisProcess()
        StaffNotificationPermission.promptOnAppOpen(this, notificationPermissionLauncher)
        if (alreadyPrompted) {
            permissionFlowSettled = true
            tryRouteNext()
        }
    }

    private fun tryRouteNext() {
        if (routed || !minDelayElapsed || !permissionFlowSettled) return
        routed = true
        maybeRegisterPushIfLoggedIn()
        routeNext()
    }

    private fun maybeRegisterPushIfLoggedIn() {
        val token = tokenStore.getToken()
        val role = tokenStore.getRole()
        if (!token.isNullOrBlank() && StaffRoleResolver.homePathForRole(role) != null) {
            StaffFcmRegistrar.registerToken(applicationContext)
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
        startActivity(Intent(this, target).apply {
            StaffPushIntentExtras.pushPathFrom(intent)?.let { pushPath ->
                putExtra(StaffWebActivity.EXTRA_PUSH_PATH, pushPath)
            }
        })
        finish()
        @Suppress("DEPRECATION")
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
    }

    companion object {
        private const val SPLASH_MIN_MS = 800L
    }
}
