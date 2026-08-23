package com.cbiseo.app.auth

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.cbiseo.app.BuildConfig
import com.cbiseo.app.R
import com.cbiseo.app.api.ApiClient
import com.cbiseo.app.api.ApiEnvironment
import com.cbiseo.app.databinding.ActivityLoginBinding
import com.cbiseo.app.session.StaffRoleResolver
import com.cbiseo.app.web.StaffWebActivity
import com.google.android.material.button.MaterialButtonToggleGroup
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private val tokenStore by lazy { TokenStore.get(this) }
    private var serverPresetBound = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.appVersionText.text = "v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"
        tokenStore.getTenantSlug()?.let { binding.inputTenantSlug.setText(it) }
        tokenStore.getLoginId()?.let { binding.inputLoginId.setText(it) }

        refreshServerPresetVisibility()
        binding.inputLoginId.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
            override fun afterTextChanged(s: Editable?) {
                refreshServerPresetVisibility()
            }
        })
        binding.loginButton.setOnClickListener { attemptLogin() }

        tryAutoLogin()
    }

    private fun tryAutoLogin() {
        val token = tokenStore.getToken()
        val role = tokenStore.getRole()
        if (!token.isNullOrBlank() && StaffRoleResolver.homePathForRole(role) != null) {
            openStaffWeb()
        }
    }

    private fun refreshServerPresetVisibility() {
        val loginId = binding.inputLoginId.text?.toString().orEmpty().trim()
        val show = ApiEnvironment.canChooseServer(loginId)
        binding.serverPresetSection.visibility = if (show) View.VISIBLE else View.GONE
        if (show) ensureServerPresetBound()
    }

    private fun ensureServerPresetBound() {
        if (serverPresetBound) return
        serverPresetBound = true
        val preset = ApiEnvironment.presetForUrl(tokenStore.getApiBaseUrl()) ?: ApiEnvironment.Preset.PRODUCTION
        binding.serverPresetGroup.check(
            when (preset) {
                ApiEnvironment.Preset.PRODUCTION -> R.id.serverPresetProduction
                ApiEnvironment.Preset.STAGING -> R.id.serverPresetStaging
            },
        )
        binding.serverPresetGroup.addOnButtonCheckedListener { _: MaterialButtonToggleGroup, checkedId: Int, isChecked: Boolean ->
            if (!isChecked) return@addOnButtonCheckedListener
        }
    }

    private fun selectedApiBaseUrlForPyo(): String =
        when (binding.serverPresetGroup.checkedButtonId) {
            R.id.serverPresetStaging -> ApiEnvironment.STAGING_URL
            else -> ApiEnvironment.PRODUCTION_URL
        }

    private fun attemptLogin() {
        val tenantSlug = binding.inputTenantSlug.text?.toString().orEmpty().trim()
        val loginId = binding.inputLoginId.text?.toString().orEmpty().trim()
        val password = binding.inputPassword.text?.toString().orEmpty()
        val apiBaseUrl = if (ApiEnvironment.canChooseServer(loginId)) {
            selectedApiBaseUrlForPyo()
        } else {
            ApiEnvironment.PRODUCTION_URL
        }
        binding.loginError.visibility = View.GONE

        if (tenantSlug.isBlank() || loginId.isBlank() || password.isBlank()) {
            showError("업체 코드, 아이디, 비밀번호를 입력해 주세요.")
            return
        }

        binding.loginButton.isEnabled = false
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                ApiClient(apiBaseUrl).login(tenantSlug, loginId, password)
            }
            binding.loginButton.isEnabled = true
            result.onSuccess { login ->
                var role = login.role ?: JwtPayload.roleFromToken(login.token)
                if (role.isNullOrBlank()) {
                    role = withContext(Dispatchers.IO) {
                        ApiClient(apiBaseUrl).fetchMe(login.token).getOrNull()
                    }
                }
                if (StaffRoleResolver.homePathForRole(role) == null) {
                    showError(getString(R.string.role_not_supported))
                    return@launch
                }
                tokenStore.saveSession(
                    token = login.token,
                    tenantSlug = tenantSlug,
                    loginId = loginId,
                    userName = login.userName,
                    userId = login.userId,
                    role = role,
                    apiBaseUrl = apiBaseUrl,
                )
                openStaffWeb()
            }.onFailure { err ->
                showError(err.message ?: "로그인에 실패했습니다.")
            }
        }
    }

    private fun showError(message: String) {
        binding.loginError.text = message
        binding.loginError.visibility = View.VISIBLE
    }

    private fun openStaffWeb() {
        startActivity(Intent(this, StaffWebActivity::class.java))
        finish()
    }
}
