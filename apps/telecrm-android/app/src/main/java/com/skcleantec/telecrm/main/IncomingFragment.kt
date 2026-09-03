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
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.FragmentIncomingBinding
import com.skcleantec.telecrm.incoming.IncomingCallDetailActivity
import com.skcleantec.telecrm.telephony.CallLogReader
import com.skcleantec.telecrm.telephony.IncomingCallRow
import com.skcleantec.telecrm.ui.SimpleRow
import com.skcleantec.telecrm.ui.SimpleRowAdapter
import com.skcleantec.telecrm.ui.StatusBadgeTone
import com.skcleantec.telecrm.ui.TelecrmInquiryLabels
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
    private val lookupByPhone = mutableMapOf<String, JSONObject>()

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
        binding.detailPanel.visibility = View.GONE
        binding.grantButton.setOnClickListener {
            permissionLauncher.launch(Manifest.permission.READ_CALL_LOG)
        }
        ensurePermission()
    }

    override fun onResume() {
        super.onResume()
        if (hasCallLogPermission()) loadCallLog()
        val pending = (activity as? MainActivity)?.consumePendingIncomingPhone()
        if (!pending.isNullOrBlank()) {
            IncomingCallDetailActivity.open(requireContext(), pending)
        }
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
            bindRows()
            enrichLookups()
        }
    }

    private fun bindRows() {
        adapter.submit(
            rows.map { row ->
                val digits = row.number.filter { it.isDigit() }
                val lookup = lookupByPhone[digits]
                val inq = lookup?.optJSONArray("inquiries")?.optJSONObject(0)
                val name = inq?.optString("customerName")?.takeIf { it.isNotBlank() }
                    ?: lookup?.optJSONObject("customer")?.optString("name")?.takeIf { it.isNotBlank() }
                    ?: getString(R.string.incoming_unregistered)
                val statusCode = inq?.optString("status")
                val badge = if (inq != null) TelecrmInquiryLabels.statusLabel(statusCode)
                else getString(R.string.incoming_unregistered)
                val tone = if (inq != null) TelecrmInquiryLabels.statusTone(statusCode) else StatusBadgeTone.NEUTRAL
                val whenStr = CallLogReader.formatWhen(row.dateMs)
                val extra = if (row.isMissed) " · 부재" else if (row.durationSec > 0) " · ${row.durationSec}초" else ""
                SimpleRow(
                    title = name,
                    subtitle = "${formatPhone(digits)} · $whenStr$extra",
                    badge = badge,
                    badgeTone = tone,
                )
            },
        )
    }

    private fun enrichLookups() {
        val token = tokenStore.getToken() ?: return
        val phones = rows.map { it.number.filter { ch -> ch.isDigit() } }.filter { it.length >= 4 }.distinct()
        if (phones.isEmpty()) return
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { apiClient.customerLookupBatch(token, phones) }
            result.onSuccess { items ->
                for (i in 0 until items.length()) {
                    val item = items.optJSONObject(i) ?: continue
                    val query = item.optString("queryPhone").filter { it.isDigit() }
                    if (query.length >= 4) lookupByPhone[query] = item
                }
                if (_binding != null) bindRows()
            }
        }
    }

    private fun onRowClick(pos: Int) {
        if (pos !in rows.indices) return
        val row = rows[pos]
        val digits = row.number.filter { it.isDigit() }
        IncomingCallDetailActivity.open(
            requireContext(),
            digits,
            row.dateMs,
            row.durationSec,
            lookupByPhone[digits],
        )
    }

    private fun formatPhone(digits: String): String {
        if (digits.length == 11 && digits.startsWith("010")) {
            return "${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7)}"
        }
        return digits
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
