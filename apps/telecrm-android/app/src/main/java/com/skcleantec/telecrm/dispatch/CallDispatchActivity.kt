package com.skcleantec.telecrm.dispatch

import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.ActivityCallDispatchBinding
import com.skcleantec.telecrm.service.TelecrmNotificationHelper
import com.skcleantec.telecrm.telephony.TelecrmCallHelper

/** PC CRM 통화 dispatch — 잠금 화면 full-screen intent 진입 */
class CallDispatchActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCallDispatchBinding
    private val tokenStore by lazy { TokenStore.get(this) }
    private val apiClient by lazy { ApiClient.fromContext(this) }
    private var pendingPhone: String? = null
    private var callFlowStarted = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyLockScreenFlags()
        binding = ActivityCallDispatchBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val phone = intent.getStringExtra(EXTRA_PHONE).orEmpty().filter { it.isDigit() }
        if (phone.length < 4) {
            finish()
            return
        }

        val inquiryId = intent.getStringExtra(EXTRA_INQUIRY_ID)
        val customerMatch = intent.getStringExtra(EXTRA_CUSTOMER_MATCH)
        val dispatchId = intent.getStringExtra(EXTRA_DISPATCH_ID)
        val autoCall = intent.getStringExtra(EXTRA_ACTION) != "prefill"

        binding.callDispatchPhone.text = formatPhone(phone)
        binding.callDispatchHint.text = if (autoCall) {
            getString(com.skcleantec.telecrm.R.string.call_dispatch_auto_hint)
        } else {
            getString(com.skcleantec.telecrm.R.string.call_dispatch_prefill_hint)
        }

        binding.callDispatchButton.setOnClickListener {
            startCallFlow(phone, inquiryId, customerMatch, dispatchId, autoCall)
        }

        pendingPhone = phone
        if (autoCall) {
            Handler(Looper.getMainLooper()).postDelayed({
                startCallFlow(phone, inquiryId, customerMatch, dispatchId, true)
            }, 400)
        }
    }

    private fun applyLockScreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            )
        }
    }

    private fun startCallFlow(
        phone: String,
        inquiryId: String?,
        customerMatch: String?,
        dispatchId: String?,
        autoCall: Boolean,
    ) {
        if (callFlowStarted) return
        callFlowStarted = true
        TelecrmNotificationHelper.cancelCallNotification(this, dispatchId)
        if (!autoCall) {
            TelecrmCallHelper.dial(this, phone)
            finish()
            return
        }

        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CALL_PHONE)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    android.Manifest.permission.CALL_PHONE,
                    android.Manifest.permission.READ_PHONE_STATE,
                ),
                REQUEST_CALL_PHONE,
            )
            TelecrmCallHelper.dial(this, phone)
            finish()
            return
        }

        TelecrmCallHelper.placeCall(this, phone)
        val token = tokenStore.getToken()
        if (!token.isNullOrBlank()) {
            TelecrmCallHelper.logOutboundCall(
                this, apiClient, token, phone, inquiryId,
                customerMatch?.takeIf { it.isNotBlank() } ?: "unknown",
            )
        }
        finish()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CALL_PHONE) {
            val phone = pendingPhone ?: return
            TelecrmCallHelper.onCallPermissionGranted(this, phone)
            finish()
        }
    }

    private fun formatPhone(digits: String): String {
        if (digits.length == 11 && digits.startsWith("010")) {
            return "${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7)}"
        }
        return digits
    }

    companion object {
        const val EXTRA_PHONE = "extra_phone"
        const val EXTRA_INQUIRY_ID = "extra_inquiry_id"
        const val EXTRA_CUSTOMER_MATCH = "extra_customer_match"
        const val EXTRA_DISPATCH_ID = "extra_dispatch_id"
        const val EXTRA_ACTION = "extra_action"
        private const val REQUEST_CALL_PHONE = 9201
    }
}
