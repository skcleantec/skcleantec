package com.skcleantec.telecrm.auth

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButtonToggleGroup
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.api.ApiEnvironment
import com.skcleantec.telecrm.databinding.ActivityLoginBinding
import com.skcleantec.telecrm.main.MainActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private val tokenStore by lazy { TokenStore(this) }
    private var serverPresetBound = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        applyLoginWindowInsets()

        tokenStore.getTenantSlug()?.let { binding.inputTenantSlug.setText(it) }
        tokenStore.getLoginId()?.let { binding.inputLoginId.setText(it) }

        val savedLoginId = tokenStore.getLoginId()
        val token = tokenStore.getToken()
        if (!token.isNullOrBlank() && savedLoginId != null) {
            val storedUrl = tokenStore.getApiBaseUrl()
            if (!ApiEnvironment.canChooseServer(savedLoginId) && storedUrl != ApiEnvironment.PRODUCTION_URL) {
                tokenStore.clearSession()
            } else {
                val apiBaseUrl = ApiEnvironment.resolveForUser(savedLoginId, storedUrl)
                openCrm(token, apiBaseUrl)
                return
            }
        }

        refreshServerPresetVisibility()
        binding.inputLoginId.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
            override fun afterTextChanged(s: Editable?) {
                refreshServerPresetVisibility()
            }
        })
        binding.loginButton.setOnClickListener { attemptLogin() }
    }

    private fun refreshServerPresetVisibility() {
        val loginId = binding.inputLoginId.text?.toString().orEmpty().trim()
        val show = ApiEnvironment.canChooseServer(loginId)
        binding.serverPresetSection.visibility = if (show) View.VISIBLE else View.GONE
        if (show) {
            ensureServerPresetBound()
        }
    }

    private fun ensureServerPresetBound() {
        if (serverPresetBound) return
        serverPresetBound = true
        val stored = ApiEnvironment.presetForUrl(tokenStore.getApiBaseUrl())
        val preset = stored ?: ApiEnvironment.Preset.PRODUCTION
        binding.serverPresetGroup.check(
            when (preset) {
                ApiEnvironment.Preset.PRODUCTION -> R.id.serverPresetProduction
                ApiEnvironment.Preset.STAGING -> R.id.serverPresetStaging
            },
        )
        binding.serverPresetGroup.addOnButtonCheckedListener { _: MaterialButtonToggleGroup, checkedId: Int, isChecked: Boolean ->
            if (!isChecked) return@addOnButtonCheckedListener
            updateServerHint(checkedId)
        }
        updateServerHint(binding.serverPresetGroup.checkedButtonId)
    }

    private fun updateServerHint(checkedId: Int) {
        binding.serverPresetHint.text = when (checkedId) {
            R.id.serverPresetProduction ->
                getString(R.string.server_preset_production_hint)
            R.id.serverPresetStaging ->
                getString(R.string.server_preset_staging_hint)
            else -> getString(R.string.server_preset_hint)
        }
    }

    private fun selectedApiBaseUrlForPyo(): String {
        val checkedId = binding.serverPresetGroup.checkedButtonId
        return when (checkedId) {
            R.id.serverPresetStaging -> ApiEnvironment.STAGING_URL
            else -> ApiEnvironment.PRODUCTION_URL
        }
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
        val pyo = ApiEnvironment.canChooseServer(loginId)
        val apiBaseUrl = if (pyo) {
            selectedApiBaseUrlForPyo()
        } else {
            ApiEnvironment.PRODUCTION_URL
        }
        binding.loginError.visibility = View.GONE

        if (tenantSlug.isBlank() || loginId.isBlank() || password.isBlank()) {
            binding.loginError.text = "업체 코드, 아이디, 비밀번호를 입력해 주세요."
            binding.loginError.visibility = View.VISIBLE
            return
        }

        val previousBase = tokenStore.getApiBaseUrl()
        if (!previousBase.isNullOrBlank() && previousBase != apiBaseUrl && tokenStore.getToken() != null) {
            tokenStore.clear()
        }
        tokenStore.saveApiBaseUrl(apiBaseUrl)

        binding.loginButton.isEnabled = false
        lifecycleScope.launch {
            val apiClient = ApiClient(apiBaseUrl)
            val result = withContext(Dispatchers.IO) {
                apiClient.login(tenantSlug, loginId, password)
            }
            binding.loginButton.isEnabled = true
            result.onSuccess { session ->
                tokenStore.saveSession(
                    session.token,
                    tenantSlug,
                    loginId,
                    session.userName,
                    session.userId,
                    apiBaseUrl,
                )
                openCrm(session.token, apiBaseUrl)
            }.onFailure { err ->
                val message = err.message ?: "로그인에 실패했습니다."
                binding.loginError.text = if (
                    pyo &&
                    apiBaseUrl == ApiEnvironment.STAGING_URL &&
                    tenantSlug.equals("cbiseo", ignoreCase = true) &&
                    message.contains("업체")
                ) {
                    "$message\n스테이징에서는 업체 코드 sk 등을 사용하세요."
                } else {
                    message
                }
                binding.loginError.visibility = View.VISIBLE
            }
        }
    }

    private fun openCrm(token: String, apiBaseUrl: String) {
        startActivity(
            Intent(this, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_API_BASE_URL, apiBaseUrl)
                .putExtra(MainActivity.EXTRA_JWT, token),
        )
        finish()
    }
}
