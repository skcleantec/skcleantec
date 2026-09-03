package com.skcleantec.telecrm.setup

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.api.ApiEnvironment
import com.skcleantec.telecrm.auth.LoginActivity
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.ActivitySetupRequiredBinding
import com.skcleantec.telecrm.main.MainActivity
import com.skcleantec.telecrm.service.TelecrmDeviceHints
import com.skcleantec.telecrm.service.TelecrmRealtimeService
import com.skcleantec.telecrm.telephony.TelecrmCallScreeningSetup

class SetupRequiredActivity : AppCompatActivity() {
    private lateinit var binding: ActivitySetupRequiredBinding
    private val tokenStore by lazy { TokenStore.get(this) }

    private val callScreeningLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { bindChecklist() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (tokenStore.getToken().isNullOrBlank()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }
        binding = ActivitySetupRequiredBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.continueButton.setOnClickListener { tryEnterCrm() }
        binding.logoutButton.setOnClickListener { logout() }
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (TelecrmRequiredSetup.isComplete(this@SetupRequiredActivity)) {
                        tryEnterCrm()
                    }
                }
            },
        )
        bindChecklist()
    }

    override fun onResume() {
        super.onResume()
        bindChecklist()
        if (TelecrmRequiredSetup.isComplete(this)) {
            tryEnterCrm()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        bindChecklist()
    }

    private fun bindChecklist() {
        val items = TelecrmRequiredSetup.items(this)
        binding.setupItems.removeAllViews()
        items.forEach { item -> binding.setupItems.addView(buildRow(item)) }
        val complete = items.all { it.done }
        binding.continueButton.isEnabled = complete
        binding.continueButton.alpha = if (complete) 1f else 0.45f
    }

    private fun buildRow(item: TelecrmSetupItem): View {
        val card = MaterialCardView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = (8 * resources.displayMetrics.density).toInt() }
            radius = 16 * resources.displayMetrics.density
            cardElevation = 0f
            strokeWidth = (1 * resources.displayMetrics.density).toInt()
            setStrokeColor(ContextCompat.getColor(this@SetupRequiredActivity, R.color.slate_200))
            setCardBackgroundColor(ContextCompat.getColor(this@SetupRequiredActivity, R.color.white))
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val pad = (14 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }
        val title = TextView(this).apply {
            text = getString(item.titleRes)
            setTextAppearance(this@SetupRequiredActivity, R.style.TextAppearance_Telecrm_CardTitle)
        }
        val status = TextView(this).apply {
            text = getString(if (item.done) R.string.setup_status_done else R.string.setup_status_needed)
            setTextColor(
                ContextCompat.getColor(
                    this@SetupRequiredActivity,
                    if (item.done) R.color.emerald_600 else R.color.amber_500,
                ),
            )
            textSize = 12f
        }
        val hint = TextView(this).apply {
            text = getString(item.hintRes)
            setTextAppearance(this@SetupRequiredActivity, R.style.TextAppearance_Telecrm_Caption)
            setPadding(0, (4 * resources.displayMetrics.density).toInt(), 0, 0)
        }
        row.addView(title)
        row.addView(status)
        row.addView(hint)
        if (!item.done) {
            val action = MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
                text = getString(R.string.setup_item_action)
                setOnClickListener { openItem(item.kind) }
            }
            row.addView(action)
        }
        card.addView(row)
        return card
    }

    private fun openItem(kind: TelecrmSetupKind) {
        when (kind) {
            TelecrmSetupKind.PHONE, TelecrmSetupKind.CALL_LOG, TelecrmSetupKind.NOTIFICATION -> {
                val needed = TelecrmRequiredSetup.runtimePermissionsNeeded(this)
                if (needed.isNotEmpty()) {
                    ActivityCompat.requestPermissions(this, needed.toTypedArray(), 4101)
                } else {
                    openAppNotificationSettings()
                }
            }
            TelecrmSetupKind.FULL_SCREEN -> TelecrmDeviceHints.openFullScreenIntentSettings(this)
            TelecrmSetupKind.BATTERY -> TelecrmDeviceHints.requestIgnoreBatteryOptimizations(this)
            TelecrmSetupKind.CALL_SCREENING -> {
                val intent = TelecrmCallScreeningSetup.createRoleRequestIntent(this)
                if (intent != null) callScreeningLauncher.launch(intent)
                else TelecrmCallScreeningSetup.openCallScreeningSettings(this)
            }
        }
    }

    private fun openAppNotificationSettings() {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        }
        if (runCatching { startActivity(intent) }.isFailure) {
            startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", packageName, null)
                },
            )
        }
    }

    private fun tryEnterCrm() {
        if (!TelecrmRequiredSetup.isComplete(this)) return
        val token = tokenStore.getToken() ?: return
        val apiBaseUrl = ApiEnvironment.resolveForUser(tokenStore.getLoginId(), tokenStore.getApiBaseUrl())
        startActivity(
            Intent(this, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_API_BASE_URL, apiBaseUrl)
                .putExtra(MainActivity.EXTRA_JWT, token),
        )
        finish()
    }

    private fun logout() {
        TelecrmRealtimeService.stop(this)
        tokenStore.clearSession()
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }

    companion object {
        fun intent(context: Context): Intent = Intent(context, SetupRequiredActivity::class.java)
    }
}
