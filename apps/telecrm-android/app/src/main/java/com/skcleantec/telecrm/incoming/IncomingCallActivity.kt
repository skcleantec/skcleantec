package com.skcleantec.telecrm.incoming

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.ActivityIncomingCallBinding
import com.skcleantec.telecrm.inquiry.InquiryDetailActivity
import com.skcleantec.telecrm.service.TelecrmNotificationHelper
import com.skcleantec.telecrm.telephony.CallReturnMonitor
import com.skcleantec.telecrm.telephony.IncomingCallSession
import com.skcleantec.telecrm.telephony.TelecrmCallHelper
import com.skcleantec.telecrm.ui.TelecrmInquiryLabels
import com.skcleantec.telecrm.ui.TelecrmLookupDetailRenderer
import org.json.JSONObject

/** SIM 수신 — CRM 고객 정보 + 잠금 화면에서 받기 */
class IncomingCallActivity : AppCompatActivity() {
    private lateinit var binding: ActivityIncomingCallBinding
    private val tokenStore by lazy { TokenStore.get(this) }
    private val apiClient by lazy { ApiClient.fromContext(this) }
    private var phoneDigits: String = ""
    private var handled = false

    private val sessionListener = { refreshCustomerUi(IncomingCallSession.lookup()) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyLockScreenFlags()
        binding = ActivityIncomingCallBinding.inflate(layoutInflater)
        setContentView(binding.root)

        phoneDigits = intent.getStringExtra(EXTRA_PHONE).orEmpty().filter { it.isDigit() }
        if (phoneDigits.length < 4) {
            finish()
            return
        }

        binding.incomingCallPhone.text = formatPhone(phoneDigits)
        binding.incomingCallCustomerName.text = getString(com.skcleantec.telecrm.R.string.incoming_call_lookup_loading)
        binding.incomingCallSummary.text = ""

        binding.incomingCallAnswerButton.setOnClickListener { answerCall() }
        binding.incomingCallDeclineButton.setOnClickListener { declineCall() }
        binding.incomingCallDetailButton.setOnClickListener { openDetail() }

        IncomingCallSession.addListener(sessionListener)
        refreshCustomerUi(IncomingCallSession.lookup())
    }

    override fun onDestroy() {
        IncomingCallSession.removeListener(sessionListener)
        super.onDestroy()
    }

    private fun refreshCustomerUi(lookup: JSONObject?) {
        if (lookup == null) {
            binding.incomingCallCustomerName.text =
                getString(com.skcleantec.telecrm.R.string.incoming_call_lookup_loading)
            binding.incomingCallDetailButton.visibility = android.view.View.GONE
            return
        }
        val inq = lookup.optJSONArray("inquiries")?.optJSONObject(0)
        val customer = lookup.optJSONObject("customer")
        val name = inq?.optString("customerName")
            ?: customer?.optString("name")
            ?: getString(com.skcleantec.telecrm.R.string.incoming_call_unknown_customer)
        val match = TelecrmInquiryLabels.matchLabel(lookup.optString("match"))
        val status = inq?.let { TelecrmInquiryLabels.statusLabel(it.optString("status")) }
        binding.incomingCallCustomerName.text = buildString {
            append(name)
            if (!status.isNullOrBlank()) append(" · ").append(status)
            else append(" · ").append(match)
        }
        binding.incomingCallSummary.text = if (inq != null) {
            TelecrmLookupDetailRenderer.summaryLines(inq, lookup).joinToString("\n")
        } else {
            getString(com.skcleantec.telecrm.R.string.incoming_call_no_inquiry)
        }
        binding.incomingCallDetailButton.visibility =
            if (inq != null) android.view.View.VISIBLE else android.view.View.GONE
    }

    private fun answerCall() {
        if (handled) return
        handled = true
        TelecrmNotificationHelper.cancelIncomingCall(this)
        CallReturnMonitor.watch(this)
        val answered = TelecrmCallHelper.answerIncomingCall(this)
        val lookup = IncomingCallSession.lookup()
        val inq = lookup?.optJSONArray("inquiries")?.optJSONObject(0)
        val token = tokenStore.getToken()
        if (!token.isNullOrBlank()) {
            TelecrmCallHelper.logCall(
                this,
                apiClient,
                token,
                phoneDigits,
                "INBOUND",
                inq?.optString("id"),
                lookup?.optString("match") ?: "unknown",
            )
        }
        if (!answered) {
            binding.incomingCallSummary.text =
                getString(com.skcleantec.telecrm.R.string.incoming_call_answer_fallback)
        }
        finish()
    }

    private fun declineCall() {
        if (handled) return
        handled = true
        TelecrmNotificationHelper.cancelIncomingCall(this)
        TelecrmCallHelper.rejectIncomingCall(this)
        finish()
    }

    private fun openDetail() {
        val lookup = IncomingCallSession.lookup() ?: return
        InquiryDetailActivity.open(this, lookup, 0)
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

    private fun formatPhone(digits: String): String {
        if (digits.length == 11 && digits.startsWith("010")) {
            return "${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7)}"
        }
        return digits
    }

    companion object {
        const val EXTRA_PHONE = "extra_incoming_phone"

        fun intent(context: Context, phone: String): Intent =
            Intent(context, IncomingCallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(EXTRA_PHONE, phone.filter { it.isDigit() })
            }
    }
}
