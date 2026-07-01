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
            else -> executeCall(payload)
        }
    }

    private fun executeCall(payload: TelecrmDispatchPayload) {
        val digits = payload.phone.filter { it.isDigit() }
        if (digits.length < 4) return
        binding.viewPager.currentItem = 0
        binding.bottomNav.selectedItemId = R.id.nav_dial
        AppEventBus.emitDialPrefill(digits, payload.inquiryId, payload.customerMatch)
        Snackbar.make(binding.root, "PC에서 통화 요청 · $digits", Snackbar.LENGTH_SHORT).show()
        val token = tokenStore.getToken() ?: return
        TelecrmCallHelper.placeCall(activity, digits)
        TelecrmCallHelper.logOutboundCall(
            activity, apiClient, token, digits, payload.inquiryId,
            payload.customerMatch?.takeIf { it.isNotBlank() } ?: "unknown",
        )
    }

    private fun showSmsDialog(payload: TelecrmDispatchPayload) {
        val digits = payload.phone.filter { it.isDigit() }
        val body = payload.body.orEmpty()
        if (digits.isEmpty() || body.isBlank()) return
        binding.viewPager.currentItem = 0
        binding.bottomNav.selectedItemId = R.id.nav_dial
        AppEventBus.emitDialPrefill(digits, payload.inquiryId, payload.customerMatch)
        AlertDialog.Builder(activity)
            .setTitle("PC에서 문자 전송 요청")
            .setMessage(body)
            .setPositiveButton("문자 앱에서 보내기") { _, _ ->
                TelecrmCallHelper.openSms(activity, digits, body)
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
