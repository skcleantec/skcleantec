package com.skcleantec.telecrm.main

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.snackbar.Snackbar
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.LoginActivity
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.ActivityMainBinding
import com.skcleantec.telecrm.dispatch.TelecrmDispatchExecutor
import com.skcleantec.telecrm.dispatch.TelecrmDispatchPayload
import com.skcleantec.telecrm.realtime.AppEventBus
import com.skcleantec.telecrm.realtime.InboxWebSocketClient
import com.skcleantec.telecrm.telephony.CallReturnMonitor
import com.skcleantec.telecrm.telephony.TelecrmCallHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private val tokenStore by lazy { TokenStore(this) }
    private val apiClient = ApiClient()
    private val webSocketClient = InboxWebSocketClient()
    private lateinit var dispatchExecutor: TelecrmDispatchExecutor
    var pendingCallPhone: String? = null
        private set

    fun armPendingCall(phone: String) {
        val digits = phone.filter { it.isDigit() }
        pendingCallPhone = digits.takeIf { it.length >= 4 }
    }

    private val pollIntervalMs = 2500L
    private val pollRunnable = object : Runnable {
        override fun run() {
            if (isDestroyed) return
            drainPendingDispatches()
            binding.root.postDelayed(this, pollIntervalMs)
        }
    }

    private val connectionListener: (Boolean) -> Unit = { connected ->
        binding.wsStatusChip.text = getString(
            if (connected) R.string.ws_connected else R.string.ws_disconnected,
        )
        binding.wsStatusChip.setBackgroundResource(
            if (connected) R.drawable.bg_chip_connected else R.drawable.bg_chip_disconnected,
        )
        if (connected) drainPendingDispatches()
    }

    private val toastListener: (AppEventBus.ToastAlert) -> Unit = { alert ->
        Snackbar.make(binding.root, "${alert.title}: ${alert.body}", Snackbar.LENGTH_LONG).show()
    }

    private val dispatchListener: (AppEventBus.DispatchPayload) -> Unit = { payload ->
        dispatchExecutor.execute(
            TelecrmDispatchPayload(
                id = payload.id,
                action = payload.action,
                phone = payload.phone,
                body = payload.body,
                imageUrl = payload.imageUrl,
                inquiryId = payload.inquiryId,
                customerMatch = payload.customerMatch,
            ),
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val token = tokenStore.getToken()
        if (token.isNullOrBlank()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        applyMainWindowInsets()
        dispatchExecutor = TelecrmDispatchExecutor(this, binding, tokenStore, apiClient)

        bindUserHeader()
        requestTelephonyPermissions()

        binding.logoutButton.setOnClickListener { logout() }

        binding.viewPager.adapter = MainPagerAdapter(this)
        binding.viewPager.isUserInputEnabled = false
        binding.viewPager.offscreenPageLimit = 4
        binding.bottomNav.selectedItemId = R.id.nav_dial

        binding.bottomNav.setOnItemSelectedListener { item ->
            binding.viewPager.currentItem = when (item.itemId) {
                R.id.nav_dial -> 0
                R.id.nav_incoming -> 1
                R.id.nav_work -> 2
                R.id.nav_messages -> 3
                else -> 0
            }
            true
        }

        webSocketClient.connect(token)
        AppEventBus.addConnectionListener(connectionListener)
        AppEventBus.addToastListener(toastListener)
        AppEventBus.addDispatchListener(dispatchListener)
        binding.root.postDelayed(pollRunnable, pollIntervalMs)
    }

    override fun onResume() {
        super.onResume()
        drainPendingDispatches()
    }

    override fun onDestroy() {
        binding.root.removeCallbacks(pollRunnable)
        AppEventBus.removeConnectionListener(connectionListener)
        AppEventBus.removeToastListener(toastListener)
        AppEventBus.removeDispatchListener(dispatchListener)
        CallReturnMonitor.unwatch()
        webSocketClient.disconnect()
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == TelecrmDispatchExecutor.REQUEST_CALL_PHONE &&
            grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        ) {
            TelecrmCallHelper.onCallPermissionGranted(this, pendingCallPhone)
            pendingCallPhone = null
        }
    }

    private fun bindUserHeader() {
        val name = tokenStore.getUserName()?.takeIf { it.isNotBlank() } ?: tokenStore.getLoginId().orEmpty()
        val tenant = tokenStore.getTenantSlug()?.uppercase().orEmpty()
        binding.userNameText.text = name
        binding.userTenantText.text = if (tenant.isNotBlank()) "업체 $tenant" else ""
    }

    private fun applyMainWindowInsets() {
        val baseHeaderPadTop = resources.getDimensionPixelSize(R.dimen.telecrm_header_padding_v)
        ViewCompat.setOnApplyWindowInsetsListener(binding.headerBar) { view, insets ->
            val top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            view.setPadding(view.paddingLeft, top + baseHeaderPadTop, view.paddingRight, view.paddingBottom)
            insets
        }
        ViewCompat.requestApplyInsets(binding.headerBar)
    }

    private fun requestTelephonyPermissions() {
        val needed = mutableListOf<String>()
        if (checkSelfPermission(android.Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            needed.add(android.Manifest.permission.CALL_PHONE)
        }
        if (checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            needed.add(android.Manifest.permission.READ_PHONE_STATE)
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), TelecrmDispatchExecutor.REQUEST_CALL_PHONE)
        }
    }

    private fun drainPendingDispatches() {
        val token = tokenStore.getToken() ?: return
        lifecycleScope.launch {
            val items = withContext(Dispatchers.IO) {
                apiClient.fetchPendingMobileDispatches(token).getOrNull().orEmpty()
            }
            items.forEach { payload -> dispatchExecutor.execute(payload) }
        }
    }

    private fun logout() {
        webSocketClient.disconnect()
        tokenStore.clearSession()
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }
}
