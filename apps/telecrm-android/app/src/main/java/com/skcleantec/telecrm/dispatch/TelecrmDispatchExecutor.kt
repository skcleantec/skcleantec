package com.skcleantec.telecrm.dispatch

import android.Manifest
import android.content.pm.PackageManager
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.snackbar.Snackbar
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.ActivityMainBinding
import com.skcleantec.telecrm.main.DialFragment
import com.skcleantec.telecrm.realtime.AppEventBus
import com.skcleantec.telecrm.telephony.TelecrmCallHelper

/** PC CRM → 휴대폰 dispatch (통화 자동 발신·문자 prefill) */
class TelecrmDispatchExecutor(
    private val activity: AppCompatActivity,
    private val binding: ActivityMainBinding,
    private val tokenStore: TokenStore,
    private val apiClient: ApiClient,
) {
    fun execute(payload: TelecrmDispatchPayload) {
        when (payload.action) {
            "sms" -> showSmsDialog(payload)
            "prefill", "call" -> executeCall(payload)
            else -> executeCall(payload)
        }
    }

    private fun executeCall(payload: TelecrmDispatchPayload) {
        val digits = payload.phone.filter { it.isDigit() }
        if (digits.length < 4) return
        binding.viewPager.currentItem = 0
        binding.bottomNav.selectedItemId = R.id.nav_dial
        binding.root.post {
            applyPrefillToDial(digits, payload.inquiryId, payload.customerMatch)
            val label = if (payload.action == "call") "PC 통화 요청" else "PC 번호 전달"
            Snackbar.make(binding.root, "$label · $digits", Snackbar.LENGTH_SHORT).show()
            if (payload.action == "prefill") return@post
            binding.root.postDelayed({
                val token = tokenStore.getToken() ?: return@postDelayed
                TelecrmCallHelper.placeCall(activity, digits)
                TelecrmCallHelper.logOutboundCall(
                    activity, apiClient, token, digits, payload.inquiryId,
                    payload.customerMatch?.takeIf { it.isNotBlank() } ?: "unknown",
                )
            }, 150)
        }
    }

    private fun applyPrefillToDial(phone: String, inquiryId: String?, customerMatch: String?) {
        AppEventBus.emitDialPrefill(phone, inquiryId, customerMatch)
        val dial = (activity.supportFragmentManager.findFragmentByTag("f0") as? DialFragment)
            ?: activity.supportFragmentManager.fragments
                .filterIsInstance<DialFragment>()
                .firstOrNull { it.isAdded }
        dial?.applyPrefill(phone, inquiryId, customerMatch)
    }

    private fun showSmsDialog(payload: TelecrmDispatchPayload) {
        val digits = payload.phone.filter { it.isDigit() }
        val body = payload.body.orEmpty()
        val imageUrl = payload.imageUrl
        if (digits.isEmpty() || (body.isBlank() && imageUrl.isNullOrBlank())) return
        binding.viewPager.currentItem = 0
        binding.bottomNav.selectedItemId = R.id.nav_dial
        AppEventBus.emitDialPrefill(digits, payload.inquiryId, payload.customerMatch)
        applyPrefillToDial(digits, payload.inquiryId, payload.customerMatch)
        val preview = buildString {
            if (body.isNotBlank()) append(body)
            if (!imageUrl.isNullOrBlank()) {
                if (isNotEmpty()) append("\n\n")
                append("[사진 첨부]")
            }
        }
        AlertDialog.Builder(activity)
            .setTitle("문자 보내기")
            .setMessage(preview)
            .setPositiveButton("문자 앱 열기") { _, _ ->
                TelecrmCallHelper.openSms(activity, digits, body, imageUrl)
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    companion object {
        const val REQUEST_CALL_PHONE = 9101

        fun hasCallPermission(activity: AppCompatActivity): Boolean =
            ContextCompat.checkSelfPermission(activity, Manifest.permission.CALL_PHONE) ==
                PackageManager.PERMISSION_GRANTED
    }
}
