package com.skcleantec.telecrm.messages

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.ActivityMessageThreadBinding
import com.skcleantec.telecrm.realtime.AppEventBus
import com.skcleantec.telecrm.ui.SimpleRow
import com.skcleantec.telecrm.ui.SimpleRowAdapter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MessageThreadActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMessageThreadBinding
    private val tokenStore by lazy { TokenStore.get(this) }
    private val apiClient by lazy { ApiClient.fromContext(this) }
    private val adapter = SimpleRowAdapter { }
    private var peerId: String = ""

    private val refreshListener = { loadMessages() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMessageThreadBinding.inflate(layoutInflater)
        setContentView(binding.root)
        peerId = intent.getStringExtra(EXTRA_USER_ID).orEmpty()
        val peerName = intent.getStringExtra(EXTRA_USER_NAME).orEmpty()
        binding.threadToolbar.setNavigationIcon(androidx.appcompat.R.drawable.abc_ic_ab_back_material)
        binding.threadToolbar.title = peerName
        binding.threadToolbar.setNavigationOnClickListener { finish() }
        binding.messageList.layoutManager = LinearLayoutManager(this)
        binding.messageList.adapter = adapter
        binding.sendButton.setOnClickListener { sendMessage() }
        loadMessages()
    }

    override fun onResume() {
        super.onResume()
        AppEventBus.addInboxRefreshListener(refreshListener)
    }

    override fun onPause() {
        AppEventBus.removeInboxRefreshListener(refreshListener)
        super.onPause()
    }

    private fun loadMessages() {
        val token = tokenStore.getToken() ?: return
        if (peerId.isBlank()) return
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { apiClient.getMessages(token, peerId) }
            result.onSuccess { arr -> renderMessages(arr) }
        }
    }

    private fun renderMessages(arr: JSONArray) {
        val myId = tokenStore.getUserId().orEmpty()
        val fmt = SimpleDateFormat("M/d HH:mm", Locale.KOREA)
        val list = mutableListOf<SimpleRow>()
        for (i in 0 until arr.length()) {
            val m = arr.getJSONObject(i)
            val mine = m.optString("senderId") == myId
            val who = if (mine) "나" else m.optJSONObject("sender")?.optString("name") ?: "상대"
            val whenStr = runCatching {
                fmt.format(Date(m.optString("createdAt")))
            }.getOrDefault("")
            list.add(SimpleRow("$who · $whenStr", m.optString("content")))
        }
        adapter.submit(list)
        binding.messageList.scrollToPosition((list.size - 1).coerceAtLeast(0))
    }

    private fun sendMessage() {
        val token = tokenStore.getToken() ?: return
        val content = binding.inputMessage.text?.toString().orEmpty().trim()
        if (content.isBlank()) return
        binding.sendButton.isEnabled = false
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                apiClient.sendMessage(token, peerId, content)
            }
            binding.sendButton.isEnabled = true
            result.onSuccess {
                binding.inputMessage.setText("")
                loadMessages()
            }
        }
    }

    companion object {
        const val EXTRA_USER_ID = "peerUserId"
        const val EXTRA_USER_NAME = "peerUserName"
    }
}
