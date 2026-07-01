package com.skcleantec.telecrm.main

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.FragmentMessagesBinding
import com.skcleantec.telecrm.messages.MessageThreadActivity
import com.skcleantec.telecrm.realtime.AppEventBus
import com.skcleantec.telecrm.ui.SimpleRow
import com.skcleantec.telecrm.ui.SimpleRowAdapter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray

class MessagesFragment : Fragment() {
    private var _binding: FragmentMessagesBinding? = null
    private val binding get() = _binding!!
    private val tokenStore by lazy { TokenStore(requireContext()) }
    private val apiClient = ApiClient()
    private val adapter = SimpleRowAdapter { pos -> openThread(pos) }
    private var conversations = JSONArray()

    private val refreshListener = { loadConversations() }

    override fun onCreateView(
        inflater: android.view.LayoutInflater,
        container: android.view.ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentMessagesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.conversationList.layoutManager = LinearLayoutManager(requireContext())
        binding.conversationList.adapter = adapter
        loadConversations()
    }

    override fun onResume() {
        super.onResume()
        AppEventBus.addInboxRefreshListener(refreshListener)
        loadConversations()
    }

    override fun onPause() {
        AppEventBus.removeInboxRefreshListener(refreshListener)
        super.onPause()
    }

    private fun loadConversations() {
        val token = tokenStore.getToken() ?: return
        binding.progress.visibility = View.VISIBLE
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { apiClient.getConversations(token) }
            binding.progress.visibility = View.GONE
            result.onSuccess { arr ->
                conversations = arr
                val list = mutableListOf<SimpleRow>()
                for (i in 0 until arr.length()) {
                    val c = arr.getJSONObject(i)
                    val last = c.optJSONObject("lastMessage")
                    val preview = last?.optString("content") ?: "대화 없음"
                    val unread = c.optInt("unreadCount", 0)
                    val badge = if (unread > 0) " · $unread" else ""
                    list.add(SimpleRow(c.optString("name"), preview + badge))
                }
                adapter.submit(list)
                binding.emptyText.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            }
        }
    }

    private fun openThread(pos: Int) {
        if (pos !in 0 until conversations.length()) return
        val c = conversations.getJSONObject(pos)
        startActivity(
            Intent(requireContext(), MessageThreadActivity::class.java)
                .putExtra(MessageThreadActivity.EXTRA_USER_ID, c.optString("id"))
                .putExtra(MessageThreadActivity.EXTRA_USER_NAME, c.optString("name")),
        )
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
