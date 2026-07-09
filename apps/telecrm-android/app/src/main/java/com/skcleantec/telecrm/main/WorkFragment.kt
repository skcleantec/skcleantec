package com.skcleantec.telecrm.main

import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.FragmentWorkBinding
import com.skcleantec.telecrm.realtime.AppEventBus
import com.skcleantec.telecrm.ui.KstDates
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class WorkFragment : Fragment() {
    private var _binding: FragmentWorkBinding? = null
    private val binding get() = _binding!!
    private val tokenStore by lazy { TokenStore.get(requireContext()) }
    private val apiClient by lazy { ApiClient.fromContext(requireContext()) }

    private val refreshListener = { loadAll() }

    override fun onCreateView(
        inflater: android.view.LayoutInflater,
        container: android.view.ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentWorkBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val slug = tokenStore.getTenantSlug().orEmpty()
        val name = tokenStore.getUserName().orEmpty()
        binding.userGreeting.text = when {
            name.isNotBlank() && slug.isNotBlank() -> "$name · $slug"
            name.isNotBlank() -> name
            else -> slug
        }
        loadAll()
    }

    override fun onResume() {
        super.onResume()
        AppEventBus.addInboxRefreshListener(refreshListener)
        loadAll()
    }

    override fun onPause() {
        AppEventBus.removeInboxRefreshListener(refreshListener)
        super.onPause()
    }

    private fun loadAll() {
        val token = tokenStore.getToken() ?: return
        binding.progress.visibility = View.VISIBLE
        lifecycleScope.launch {
            val summary = withContext(Dispatchers.IO) { apiClient.getCallSessionSummary(token, KstDates.todayYmd()) }
            val badges = withContext(Dispatchers.IO) { apiClient.getAdminNavBadges(token) }
            binding.progress.visibility = View.GONE
            summary.onSuccess { json ->
                val count = json.optInt("callCount", 0)
                val totalSec = json.optInt("totalDurationSec", 0)
                binding.summaryStats.text = getString(R.string.summary_stats_format, count, KstDates.formatDuration(totalSec))
                val byMatch = json.optJSONObject("byCustomerMatch")
                if (byMatch != null && byMatch.length() > 0) {
                    val parts = mutableListOf<String>()
                    for (key in byMatch.keys()) parts.add("${KstDates.matchLabel(key)} ${byMatch.optInt(key, 0)}")
                    binding.summaryMatch.text = parts.joinToString(" · ")
                    binding.summaryMatch.visibility = View.VISIBLE
                } else binding.summaryMatch.visibility = View.GONE
            }
            badges.onSuccess { b ->
                binding.badgeMessages.text = "미읽음 메시지 ${b.optInt("unreadCount", 0)}건"
                binding.badgeCs.text = "C/S 대기 ${b.optInt("csPendingCount", 0)}건"
                binding.badgeReview.text = "페이백 미확인 ${b.optInt("reviewPaybackUnseenCount", 0)}건"
            }
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
