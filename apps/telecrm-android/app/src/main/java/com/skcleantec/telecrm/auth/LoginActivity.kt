package com.skcleantec.telecrm.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.main.MainActivity
import com.skcleantec.telecrm.databinding.ActivityLoginBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private val tokenStore by lazy { TokenStore(this) }
    private val apiClient = ApiClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        tokenStore.getTenantSlug()?.let { binding.inputTenantSlug.setText(it) }
        tokenStore.getLoginId()?.let { binding.inputLoginId.setText(it) }

        if (tokenStore.getToken() != null) {
            openCrm()
            return
        }

        binding.loginButton.setOnClickListener { attemptLogin() }
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
