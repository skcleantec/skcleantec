package com.skcleantec.telecrm.main

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.edit
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.material.snackbar.Snackbar
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.api.ApiEnvironment
import com.skcleantec.telecrm.auth.LoginActivity
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.ActivityMainBinding
import com.skcleantec.telecrm.dispatch.TelecrmDispatchExecutor
import com.skcleantec.telecrm.dispatch.TelecrmDispatchPayload
import com.skcleantec.telecrm.realtime.AppEventBus
import com.skcleantec.telecrm.service.TelecrmAppState
import com.skcleantec.telecrm.service.TelecrmDeviceHints
import com.skcleantec.telecrm.service.TelecrmRealtimeService
import com.skcleantec.telecrm.telephony.CallLogReader
import com.skcleantec.telecrm.telephony.CallLogSync
import com.skcleantec.telecrm.telephony.CallReturnMonitor
import com.skcleantec.telecrm.telephony.TelecrmCallHelper
import com.skcleantec.telecrm.ui.AppVersion
import com.skcleantec.telecrm.update.TelecrmApkInstall
import com.skcleantec.telecrm.update.TelecrmUpdateCoordinator
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    companion object {
        const val EXTRA_API_BASE_URL = "extra_api_base_url"
        const val EXTRA_JWT = "extra_jwt"
        const val EXTRA_PREFILL_PHONE = "extra_prefill_phone"
        const val EXTRA_PREFILL_INQUIRY_ID = "extra_prefill_inquiry_id"
        const val EXTRA_PREFILL_CUSTOMER_MATCH = "extra_prefill_customer_match"
        private const val PREFS_SETUP = "telecrm_setup_hints"
        private const val KEY_HINT_SHOWN = "galaxy_hints_shown"

        fun prefillIntent(context: Context, payload: TelecrmDispatchPayload): Intent {
            val digits = payload.phone.filter { it.isDigit() }
            return Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra(EXTRA_PREFILL_PHONE, digits)
                putExtra(EXTRA_PREFILL_INQUIRY_ID, payload.inquiryId)
                putExtra(EXTRA_PREFILL_CUSTOMER_MATCH, payload.customerMatch)
            }
        }
    }

    private lateinit var binding: ActivityMainBinding
    private val tokenStore by lazy { TokenStore.get(this) }
    private lateinit var apiBaseUrl: String
    private lateinit var apiClient: ApiClient
    private lateinit var dispatchExecutor: TelecrmDispatchExecutor
    var pendingCallPhone: String? = null
        private set

    fun armPendingCall(phone: String) {
        val digits = phone.filter { it.isDigit() }
        pendingCallPhone = digits.takeIf { it.length >= 4 }
    }

    private val connectionListener: (Boolean) -> Unit = { connected ->
        if (::binding.isInitialized && !isDestroyed) {
            binding.wsStatusChip.text = getString(
                if (connected) R.string.ws_connected else R.string.ws_disconnected,
            )
            binding.wsStatusChip.setBackgroundResource(
                if (connected) R.drawable.bg_chip_connected else R.drawable.bg_chip_disconnected,
            )
        }
    }

    private val toastListener: (AppEventBus.ToastAlert) -> Unit = { alert ->
        if (::binding.isInitialized && !isDestroyed) {
            Snackbar.make(binding.root, "${alert.title}: ${alert.body}", Snackbar.LENGTH_LONG).show()
        }
    }

    private val dispatchListener: (AppEventBus.DispatchPayload) -> Unit = { payload ->
        if (::dispatchExecutor.isInitialized && !isDestroyed) {
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
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val token = intent.getStringExtra(EXTRA_JWT) ?: tokenStore.getToken()
        apiBaseUrl = intent.getStringExtra(EXTRA_API_BASE_URL)
            ?: ApiEnvironment.resolveForUser(tokenStore.getLoginId(), tokenStore.getApiBaseUrl())
        if (token.isNullOrBlank()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }
        apiClient = ApiClient(apiBaseUrl)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        applyMainWindowInsets()
        dispatchExecutor = TelecrmDispatchExecutor(this, binding, tokenStore, apiClient)

        bindUserHeader()
        requestRuntimePermissions()
        binding.root.post { maybeShowGalaxySetupHints() }

        binding.logoutButton.setOnClickListener { logout() }

        binding.viewPager.adapter = MainPagerAdapter(this)
        binding.viewPager.isUserInputEnabled = false
        binding.viewPager.offscreenPageLimit = 1
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

        binding.root.post {
            TelecrmRealtimeService.start(this@MainActivity)
        }
        AppEventBus.addConnectionListener(connectionListener)
        AppEventBus.addToastListener(toastListener)
        AppEventBus.addDispatchListener(dispatchListener)
        handlePrefillIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handlePrefillIntent(intent)
    }

    private fun handlePrefillIntent(intent: Intent?) {
        val source = intent ?: return
        val phone = source.getStringExtra(EXTRA_PREFILL_PHONE)?.filter { it.isDigit() }.orEmpty()
        if (phone.length < 4 || !::dispatchExecutor.isInitialized) return
        source.removeExtra(EXTRA_PREFILL_PHONE)
        dispatchExecutor.execute(
            TelecrmDispatchPayload(
                id = null,
                action = "prefill",
                phone = phone,
                body = null,
                imageUrl = null,
                inquiryId = source.getStringExtra(EXTRA_PREFILL_INQUIRY_ID),
                customerMatch = source.getStringExtra(EXTRA_PREFILL_CUSTOMER_MATCH),
            ),
        )
    }

    override fun onResume() {
        super.onResume()
        TelecrmAppState.isMainInForeground = true
        if (CallLogReader.hasCallLogPermission(this)) {
            Thread { CallLogSync.syncRecent(applicationContext, 24) }.start()
        }
        if (::apiBaseUrl.isInitialized) {
            lifecycleScope.launch {
                TelecrmUpdateCoordinator.checkOnMain(this@MainActivity, apiBaseUrl)
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == TelecrmApkInstall.REQUEST_INSTALL_PERMISSION) {
            TelecrmUpdateCoordinator.onInstallPermissionResult(this)
        }
    }

    override fun onPause() {
        TelecrmAppState.isMainInForeground = false
        super.onPause()
    }

    override fun onDestroy() {
        AppEventBus.removeConnectionListener(connectionListener)
        AppEventBus.removeToastListener(toastListener)
        AppEventBus.removeDispatchListener(dispatchListener)
        CallReturnMonitor.unwatch()
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
        val host = apiBaseUrl.toUri().host.orEmpty()
        val envLabel = when (ApiEnvironment.presetForUrl(apiBaseUrl)) {
            ApiEnvironment.Preset.PRODUCTION -> "운영"
            ApiEnvironment.Preset.STAGING -> "스테이징"
            else -> "서버"
        }
        binding.userNameText.text = name
        binding.userTenantText.text = buildString {
            if (tenant.isNotBlank()) append("업체 $tenant")
            if (host.isNotBlank()) {
                if (isNotEmpty()) append(" · ")
                append("$envLabel · $host")
            }
        }
        binding.appVersionText.text = AppVersion.displayLabel(this)
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

    private fun requestRuntimePermissions() {
        val needed = mutableListOf<String>()
        if (checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CALL_PHONE)
        }
        if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.READ_PHONE_STATE)
        }
        if (checkSelfPermission(Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.READ_CALL_LOG)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), TelecrmDispatchExecutor.REQUEST_CALL_PHONE)
        }
    }

    private fun maybeShowGalaxySetupHints() {
        val prefs = getSharedPreferences(PREFS_SETUP, MODE_PRIVATE)
        if (prefs.getBoolean(KEY_HINT_SHOWN, false)) return

        val needsFullScreen = TelecrmDeviceHints.shouldPromptFullScreenIntent(this)
        if (!needsFullScreen) {
            prefs.edit { putBoolean(KEY_HINT_SHOWN, true) }
            return
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.galaxy_setup_title)
            .setMessage(R.string.galaxy_setup_message)
            .setPositiveButton(R.string.galaxy_setup_fullscreen) { _, _ ->
                TelecrmDeviceHints.openFullScreenIntentSettings(this)
            }
            .setNeutralButton(R.string.galaxy_setup_battery) { _, _ ->
                TelecrmDeviceHints.openBatteryOptimizationSettings(this)
            }
            .setNegativeButton(android.R.string.ok, null)
            .show()
        prefs.edit { putBoolean(KEY_HINT_SHOWN, true) }
    }

    private fun logout() {
        TelecrmRealtimeService.stop(this)
        tokenStore.clearSession()
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }
}
