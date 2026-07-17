package com.skcleantec.telecrm.main

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.api.SmsTemplateDto
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.FragmentIncomingBinding
import com.skcleantec.telecrm.telephony.CallLogReader
import com.skcleantec.telecrm.telephony.CallLogRow
import com.skcleantec.telecrm.telephony.CallLogSync
import com.skcleantec.telecrm.telephony.IncomingCallRow
import com.skcleantec.telecrm.telephony.TelecrmCallHelper
import com.skcleantec.telecrm.ui.SimpleRow
import com.skcleantec.telecrm.ui.SimpleRowAdapter
import com.skcleantec.telecrm.ui.SmsTemplateHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class IncomingFragment : Fragment() {
    private var _binding: FragmentIncomingBinding? = null
    private val binding get() = _binding!!
    private val tokenStore by lazy { TokenStore.get(requireContext()) }
    private val apiClient by lazy { ApiClient.fromContext(requireContext()) }
    private val adapter = SimpleRowAdapter { pos -> onRowClick(pos) }
    private var rows = listOf<IncomingCallRow>()
    private var selectedLookup: JSONObject? = null
    private var selectedPhone = ""
    private var smsTemplates = listOf<SmsTemplateDto>()

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) loadCallLog() else showPermissionUi(true)
    }

    override fun onCreateView(
        inflater: android.view.LayoutInflater,
        container: android.view.ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentIncomingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.incomingList.layoutManager = LinearLayoutManager(requireContext())
        binding.incomingList.adapter = adapter
        binding.grantButton.setOnClickListener {
            permissionLauncher.launch(Manifest.permission.READ_CALL_LOG)
        }
        binding.detailCall.setOnClickListener {
            val phone = selectedPhone
            TelecrmCallHelper.dial(requireContext(), phone)
            val token = tokenStore.getToken() ?: return@setOnClickListener
            val match = selectedLookup?.optString("match") ?: "unknown"
            val inquiryId = selectedLookup?.optJSONArray("inquiries")?.optJSONObject(0)?.optString("id")
            TelecrmCallHelper.logCall(requireContext(), apiClient, token, phone, "INBOUND", inquiryId, match)
        }
        binding.detailSms.setOnClickListener { TelecrmCallHelper.openSms(requireContext(), selectedPhone) }
        loadSmsTemplates()
        ensurePermission()
    }

    override fun onResume() {
        super.onResume()
        if (hasCallLogPermission()) loadCallLog()
        loadSmsTemplates()
    }

    private fun hasCallLogPermission() =
        ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.READ_CALL_LOG) ==
            PackageManager.PERMISSION_GRANTED

    private fun ensurePermission() {
        if (hasCallLogPermission()) {
            showPermissionUi(false)
            loadCallLog()
        } else {
            showPermissionUi(true)
        }
    }

    private fun showPermissionUi(need: Boolean) {
        binding.permissionHint.visibility = if (need) View.VISIBLE else View.GONE
        binding.grantButton.visibility = if (need) View.VISIBLE else View.GONE
    }

    private fun loadCallLog() {
        lifecycleScope.launch {
            val loaded = withContext(Dispatchers.IO) {
                CallLogReader.readRecentIncoming(requireContext())
            }
            if (_binding == null) return@launch
            rows = loaded
            adapter.submit(rows.map {
                SimpleRow(
                    title = it.number,
                    subtitle = "${CallLogReader.formatWhen(it.dateMs)} · ${it.durationSec}초",
                )
            })
        }
    }

    private fun loadSmsTemplates() {
        val token = tokenStore.getToken() ?: return
        lifecycleScope.launch {
            smsTemplates = withContext(Dispatchers.IO) { apiClient.getSmsTemplates(token).getOrDefault(emptyList()) }
            bindIncomingTemplateChips()
        }
    }

    private fun bindIncomingTemplateChips() {
        SmsTemplateHelper.bindTemplateChips(
            requireContext(),
            binding.incomingSmsTemplateChips,
            null,
            smsTemplates,
        ) { template -> sendIncomingTemplate(template) }
    }

    private fun sendIncomingTemplate(template: SmsTemplateDto) {
        val token = tokenStore.getToken() ?: return
        lifecycleScope.launch {
            var ctx = SmsTemplateHelper.placeholderCtxFromLookup(selectedPhone, selectedLookup)
            val inquiryId = selectedLookup?.optJSONArray("inquiries")?.optJSONObject(0)?.optString("id")
            ctx = SmsTemplateHelper.enrichOrderLink(apiClient, token, ctx, inquiryId)
            SmsTemplateHelper.sendTemplate(requireContext(), selectedPhone, template, ctx)
        }
    }

    private fun onRowClick(pos: Int) {
        if (pos !in rows.indices) return
        val row = rows[pos]
        selectedPhone = row.number.filter { it.isDigit() }
        binding.detailPanel.visibility = View.VISIBLE
        binding.detailTitle.text = row.number
        binding.detailBody.text = "조회 중…"
        bindIncomingTemplateChips()
        val token = tokenStore.getToken() ?: return
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                apiClient.customerLookup(token, selectedPhone, null)
            }
            result.onSuccess { json ->
                selectedLookup = json
                val inq = json.optJSONArray("inquiries")?.optJSONObject(0)
                val customer = json.optJSONObject("customer")
                val name = inq?.optString("customerName")
                    ?: customer?.optString("name")
                    ?: "미등록"
                val match = when (json.optString("match")) {
                    "existing" -> "기존 고객"
                    "new" -> "신규"
                    else -> json.optString("match")
                }
                val memo = inq?.optString("memo").orEmpty()
                binding.detailTitle.text = "$name · $match"
                binding.detailBody.text = buildString {
                    append(selectedPhone)
                    inq?.optString("address")?.takeIf { it.isNotBlank() }?.let { append("\n$it") }
                    if (memo.isNotBlank()) append("\n$memo")
                }
                val logRow = CallLogRow(row.id, row.number, row.dateMs, row.durationSec, android.provider.CallLog.Calls.INCOMING_TYPE)
                CallLogSync.syncKnownRow(
                    requireContext(),
                    logRow,
                    inq?.optString("id"),
                    json.optString("match"),
                )
            }.onFailure {
                binding.detailBody.text = it.message ?: "조회 실패"
            }
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
