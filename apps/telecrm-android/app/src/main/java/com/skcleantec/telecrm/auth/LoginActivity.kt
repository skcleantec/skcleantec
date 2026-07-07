package com.skcleantec.telecrm.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.databinding.ActivityLoginBinding
import com.skcleantec.telecrm.main.MainActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private val tokenStore by lazy { TokenStore(this) }
    private val apiClient = ApiClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        applyLoginWindowInsets()

        tokenStore.getTenantSlug()?.let { binding.inputTenantSlug.setText(it) }
        tokenStore.getLoginId()?.let { binding.inputLoginId.setText(it) }

        if (tokenStore.getToken() != null) {
            openCrm()
            return
        }

        binding.loginButton.setOnClickListener { attemptLogin() }
    }

    private fun applyLoginWindowInsets() {
        val baseHeroHeight = resources.getDimensionPixelSize(R.dimen.telecrm_login_hero_height)
        val logoTopExtra = resources.getDimensionPixelSize(R.dimen.telecrm_login_logo_top)

        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { _, insets ->
            val top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top

            val heroLp = binding.loginHero.layoutParams
            heroLp.height = baseHeroHeight + top
            binding.loginHero.layoutParams = heroLp

            val logoLp = binding.loginLogo.layoutParams as ConstraintLayout.LayoutParams
            logoLp.topMargin = top + logoTopExtra
            binding.loginLogo.layoutParams = logoLp

            insets
        }
        ViewCompat.requestApplyInsets(binding.root)
    }

    private fun attemptLogin() {
        val tenantSlug = binding.inputTenantSlug.text?.toString().orEmpty().trim()
        val loginId = binding.inputLoginId.text?.toString().orEmpty().trim()
        val password = binding.inputPassword.text?.toString().orEmpty()
        binding.loginError.visibility = View.GONE

        if (tenantSlug.isBlank() || loginId.isBlank() || password.isBlank()) {
            binding.loginError.text = "업체 코드, 아이디, 비밀번호를 입력해 주세요."
            binding.loginError.visibility = View.VISIBLE
            return
        }

        binding.loginButton.isEnabled = false
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                apiClient.login(tenantSlug, loginId, password)
            }
            binding.loginButton.isEnabled = true
            result.onSuccess { session ->
                tokenStore.saveSession(session.token, tenantSlug, loginId, session.userName, session.userId)
                openCrm()
            }.onFailure { err ->
                binding.loginError.text = err.message ?: "로그인에 실패했습니다."
                binding.loginError.visibility = View.VISIBLE
            }
        }
    }

    private fun openCrm() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
