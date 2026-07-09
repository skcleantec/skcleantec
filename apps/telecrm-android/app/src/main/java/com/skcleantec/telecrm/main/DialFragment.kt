package com.skcleantec.telecrm.main



import android.os.Bundle

import android.text.Editable

import android.text.TextWatcher

import android.view.View

import androidx.fragment.app.Fragment

import androidx.lifecycle.lifecycleScope

import com.skcleantec.telecrm.R

import com.skcleantec.telecrm.api.ApiClient

import com.skcleantec.telecrm.api.SmsTemplateDto

import com.skcleantec.telecrm.auth.TokenStore

import com.skcleantec.telecrm.databinding.FragmentDialBinding

import com.skcleantec.telecrm.realtime.AppEventBus

import com.skcleantec.telecrm.telephony.TelecrmCallHelper

import com.skcleantec.telecrm.ui.CustomerLookupState

import com.skcleantec.telecrm.ui.CustomerLookupUi

import com.skcleantec.telecrm.ui.SmsTemplateHelper

import kotlinx.coroutines.Dispatchers

import kotlinx.coroutines.launch

import kotlinx.coroutines.withContext



class DialFragment : Fragment() {

    private var _binding: FragmentDialBinding? = null

    private val binding get() = _binding!!

    private val tokenStore by lazy { TokenStore(requireContext()) }

    private val apiClient by lazy { ApiClient.fromContext(requireContext()) }

    private val lookupState = CustomerLookupState()

    private var smsTemplates = listOf<SmsTemplateDto>()



    private val refreshListener = { loadSmsTemplates() }



    private val dialPrefillListener: (AppEventBus.DialPrefill) -> Unit = { prefill ->
        applyPrefill(prefill.phone, prefill.inquiryId, prefill.customerMatch)
    }

    fun applyPrefill(phone: String, inquiryId: String?, customerMatch: String?) {
        if (_binding == null) return
        binding.inputPhone.setText(phone)
        lookupState.selectedPhone = phone
        lookupState.selectedInquiryId = inquiryId
        customerMatch?.let { lookupState.match = it }
        updatePhoneClearUi()
        updateActionRowVisibility()
    }



    private val phoneWatcher = object : TextWatcher {

        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit

        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {

            updatePhoneClearUi()

            updateActionRowVisibility()

        }

        override fun afterTextChanged(s: Editable?) = Unit

    }



    override fun onCreateView(

        inflater: android.view.LayoutInflater,

        container: android.view.ViewGroup?,

        savedInstanceState: Bundle?,

    ): View {

        _binding = FragmentDialBinding.inflate(inflater, container, false)

        return binding.root

    }



    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {

        binding.inputPhone.showSoftInputOnFocus = false

        binding.inputPhone.addTextChangedListener(phoneWatcher)

        setupDialPad()

        binding.clearPhoneButton.setOnClickListener { clearPhone() }

        binding.clearPhoneTextButton.setOnClickListener { clearPhone() }

        binding.searchButton.setOnClickListener { searchCustomer() }

        binding.callButton.setOnClickListener { performCall() }

        binding.smsButton.setOnClickListener {

            TelecrmCallHelper.openSms(requireContext(), activePhone())

        }

        loadSmsTemplates()

        updatePhoneClearUi()

        updateActionRowVisibility()

        AppEventBus.addDialPrefillListener(dialPrefillListener)

    }



    private fun setupDialPad() {

        val digitKeys = mapOf(

            R.id.dialKey0 to "0",

            R.id.dialKey1 to "1",

            R.id.dialKey2 to "2",

            R.id.dialKey3 to "3",

            R.id.dialKey4 to "4",

            R.id.dialKey5 to "5",

            R.id.dialKey6 to "6",

            R.id.dialKey7 to "7",

            R.id.dialKey8 to "8",

            R.id.dialKey9 to "9",

            R.id.dialKeyStar to "*",

            R.id.dialKeyHash to "#",

        )

        digitKeys.forEach { (viewId, digit) ->

            binding.root.findViewById<View>(viewId).setOnClickListener { appendDigit(digit) }

        }

        binding.dialKeyBackspace.setOnClickListener { backspaceDigit() }

        binding.dialKeyBackspace.setOnLongClickListener {

            clearPhone()

            true

        }

    }



    private fun appendDigit(digit: String) {

        val current = binding.inputPhone.text?.toString().orEmpty()

        binding.inputPhone.setText(current + digit)

        binding.inputPhone.setSelection(binding.inputPhone.text?.length ?: 0)

    }



    private fun backspaceDigit() {

        val current = binding.inputPhone.text?.toString().orEmpty()

        if (current.isEmpty()) return

        binding.inputPhone.setText(current.dropLast(1))

        binding.inputPhone.setSelection(binding.inputPhone.text?.length ?: 0)

    }



    private fun clearPhone() {

        binding.inputPhone.text?.clear()

        CustomerLookupUi.clear(binding.candidatesContainer, binding.inquiriesContainer, binding.actionRow, lookupState)

        updatePhoneClearUi()

        updateActionRowVisibility()

    }



    private fun updatePhoneClearUi() {

        val hasText = binding.inputPhone.text?.isNotEmpty() == true

        val vis = if (hasText) View.VISIBLE else View.GONE

        binding.clearPhoneButton.visibility = vis

        binding.clearPhoneTextButton.visibility = vis

    }



    private fun loadSmsTemplates() {

        val token = tokenStore.getToken() ?: return

        lifecycleScope.launch {

            val templates = withContext(Dispatchers.IO) { apiClient.getSmsTemplates(token).getOrDefault(emptyList()) }

            smsTemplates = templates

            SmsTemplateHelper.bindTemplateChips(

                requireContext(),

                binding.smsTemplateChips,

                binding.smsTemplateEmpty,

                templates,

            ) { template -> sendSmsTemplate(template) }

        }

    }



    private fun sendSmsTemplate(template: SmsTemplateDto) {

        val token = tokenStore.getToken() ?: return

        val phone = activePhone()

        lifecycleScope.launch {

            var ctx = SmsTemplateHelper.placeholderCtxFromState(phone, lookupState)

            ctx = SmsTemplateHelper.enrichOrderLink(apiClient, token, ctx, lookupState.selectedInquiryId)

            lookupState.orderLink = ctx.orderLink

            SmsTemplateHelper.sendTemplate(requireContext(), phone, template, ctx)

        }

    }



    override fun onResume() {

        super.onResume()

        AppEventBus.addInboxRefreshListener(refreshListener)

        loadSmsTemplates()

    }



    override fun onPause() {

        AppEventBus.removeInboxRefreshListener(refreshListener)

        super.onPause()

    }



    private fun updateActionRowVisibility() {

        val digits = binding.inputPhone.text?.toString()?.filter { it.isDigit() }.orEmpty()

        binding.actionRow.visibility =

            if (digits.length >= 8 || lookupState.selectedPhone.filter { it.isDigit() }.length >= 8) {

                View.VISIBLE

            } else {

                View.GONE

            }

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

                if (!lookupState.selectedInquiryId.isNullOrBlank()) {

                    val link = withContext(Dispatchers.IO) {

                        apiClient.getOrderFormLink(token, lookupState.selectedInquiryId!!).getOrNull()

                    }

                    lookupState.orderLink = link

                }

                updateActionRowVisibility()

            }.onFailure {

                binding.searchError.text = it.message

                binding.searchError.visibility = View.VISIBLE

                updateActionRowVisibility()

            }

        }

    }



    private fun performCall() {

        val phone = activePhone()

        val activity = requireActivity()

        if (activity is MainActivity) {

            TelecrmCallHelper.placeCall(activity, phone)

        } else {

            TelecrmCallHelper.dial(requireContext(), phone)

        }

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

        AppEventBus.removeDialPrefillListener(dialPrefillListener)

        binding.inputPhone.removeTextChangedListener(phoneWatcher)

        _binding = null

        super.onDestroyView()

    }

}


