package com.skcleantec.telecrm.main

import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.FragmentDialBinding
import com.skcleantec.telecrm.realtime.AppEventBus
import com.skcleantec.telecrm.telephony.TelecrmCallHelper
import com.skcleantec.telecrm.ui.CustomerLookupState
import com.skcleantec.telecrm.ui.CustomerLookupUi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DialFragment : Fragment() {
    private var _binding: FragmentDialBinding? = null
    private val binding get() = _binding!!
    private val tokenStore by lazy { TokenStore(requireContext()) }
    private val apiClient = ApiClient()
    private val lookupState = CustomerLookupState()

    private val refreshListener = { /* dial tab no auto refresh */ }

    override fun onCreateView(
        inflater: android.view.LayoutInflater,
        container: android.view.ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentDialBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.searchButton.setOnClickListener { searchCustomer() }
        binding.callButton.setOnClickListener { performCall() }
        binding.smsButton.setOnClickListener { TelecrmCallHelper.openSms(requireContext(), activePhone()) }
    }

    override fun onResume() {
        super.onResume()
        AppEventBus.addInboxRefreshListener(refreshListener)
    }

    override fun onPause() {
        AppEventBus.removeInboxRefreshListener(refreshListener)
        super.onPause()
    }

    private fun searchCustomer() {
        val token = tokenStore.getToken() ?: return
        val phone = binding.inputPhone.text?.toString().orEmpty().trim()
        val name = binding.inputName.text?.toString().orEmpty().trim()
        binding.searchError.visibility = View.GONE
        CustomerLookupUi.clear(binding.candidatesContainer, binding.inquiriesContainer, binding.actionRow, lookupState)
        if (phone.isBlank() && name.length < 2) {
            binding.searchError.text = "전화번호 또는 이름(2자 이상)을 입력해 주세요."
            binding.searchError.visibility = View.VISIBLE
            return
        }
        binding.progress.visibility = View.VISIBLE
        binding.searchButton.isEnabled = false
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                apiClient.customerLookup(token, phone.takeIf { it.isNotBlank() }, name.takeIf { it.isNotBlank() })
            }
            binding.progress.visibility = View.GONE
            binding.searchButton.isEnabled = true
            result.onSuccess { json ->
                CustomerLookupUi.render(
                    requireContext(), json, phone, binding.candidatesContainer, binding.inquiriesContainer,
                    binding.actionRow, lookupState,
                ) { p, n ->
                    binding.inputPhone.setText(p)
                    binding.inputName.setText(n)
                    searchCustomer()
                }
            }.onFailure {
                binding.searchError.text = it.message
                binding.searchError.visibility = View.VISIBLE
            }
        }
    }

    private fun performCall() {
        val phone = activePhone()
        TelecrmCallHelper.dial(requireContext(), phone)
        val token = tokenStore.getToken() ?: return
        TelecrmCallHelper.logOutboundCall(
            requireContext(), apiClient, token, phone, lookupState.selectedInquiryId,
            if (lookupState.match in listOf("existing", "new", "pick")) lookupState.match else "unknown",
        )
    }

    private fun activePhone(): String =
        binding.inputPhone.text?.toString()?.filter { it.isDigit() }.orEmpty()
            .ifBlank { lookupState.selectedPhone.filter { it.isDigit() } }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
