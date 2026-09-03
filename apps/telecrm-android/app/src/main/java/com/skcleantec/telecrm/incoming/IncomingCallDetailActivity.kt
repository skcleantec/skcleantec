package com.skcleantec.telecrm.incoming

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.ActivityIncomingCallDetailBinding
import com.skcleantec.telecrm.inquiry.InquiryDetailActivity
import com.skcleantec.telecrm.telephony.CallLogReader
import com.skcleantec.telecrm.telephony.CallLogRow
import com.skcleantec.telecrm.telephony.CallLogSync
import com.skcleantec.telecrm.telephony.TelecrmCallHelper
import com.skcleantec.telecrm.ui.TelecrmDateFormat
import com.skcleantec.telecrm.ui.TelecrmInquiryLabels
import com.skcleantec.telecrm.ui.TelecrmLookupDetailRenderer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class IncomingCallDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityIncomingCallDetailBinding
    private val tokenStore by lazy { TokenStore.get(this) }
    private val apiClient by lazy { ApiClient.fromContext(this) }
    private var lookup: JSONObject? = null
    private var phone = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityIncomingCallDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.toolbar.setNavigationOnClickListener { finish() }

        phone = intent.getStringExtra(EXTRA_PHONE)?.filter { it.isDigit() }.orEmpty()
        if (phone.length < 4) {
            finish()
            return
        }
        lookup = intent.getStringExtra(EXTRA_LOOKUP_JSON)?.let { runCatching { JSONObject(it) }.getOrNull() }
        bindHeader()
        bindInquiry()

        binding.callButton.setOnClickListener {
            TelecrmCallHelper.dial(this, phone)
            val token = tokenStore.getToken() ?: return@setOnClickListener
            val match = lookup?.optString("match") ?: "unknown"
            val inquiryId = lookup?.optJSONArray("inquiries")?.optJSONObject(0)?.optString("id")
            TelecrmCallHelper.logCall(this, apiClient, token, phone, "INBOUND", inquiryId, match)
        }
        binding.smsButton.setOnClickListener { TelecrmCallHelper.openSms(this, phone) }
        binding.inquiryDetailButton.setOnClickListener {
            val json = lookup ?: return@setOnClickListener
            InquiryDetailActivity.open(this, json, 0)
        }

        loadLookupIfNeeded()
        loadCallHistory()
        loadChangeHistory()
    }

    private fun bindHeader() {
        val inq = lookup?.optJSONArray("inquiries")?.optJSONObject(0)
        val name = inq?.optString("customerName")?.takeIf { it.isNotBlank() }
            ?: lookup?.optJSONObject("customer")?.optString("name")?.takeIf { it.isNotBlank() }
            ?: getString(R.string.incoming_unregistered)
        val statusCode = inq?.optString("status")
        val badge = if (inq != null) TelecrmInquiryLabels.statusLabel(statusCode) else getString(R.string.incoming_unregistered)
        val tone = TelecrmInquiryLabels.statusTone(if (inq != null) statusCode else null)
        binding.nameText.text = name
        binding.statusBadge.text = badge
        binding.statusBadge.setTextColor(ContextCompat.getColor(this, tone.fgRes))
        binding.statusBadge.setBackgroundResource(tone.bgRes)
        val whenMs = intent.getLongExtra(EXTRA_DATE_MS, 0L)
        val duration = intent.getIntExtra(EXTRA_DURATION_SEC, 0)
        val whenStr = if (whenMs > 0) CallLogReader.formatWhen(whenMs) else ""
        val extra = if (duration > 0) " · ${duration}초" else ""
        binding.phoneMeta.text = listOf(formatPhone(phone), whenStr).filter { it.isNotBlank() }.joinToString(" · ") + extra
    }

    private fun bindInquiry() {
        val inq = lookup?.optJSONArray("inquiries")?.optJSONObject(0)
        val json = lookup
        if (inq == null || json == null) {
            binding.inquirySummary.text = getString(R.string.incoming_no_inquiry)
            binding.inquiryDetailButton.visibility = View.GONE
            return
        }
        binding.inquirySummary.text = TelecrmLookupDetailRenderer.summaryLines(inq, json).joinToString("\n")
        binding.inquiryDetailButton.visibility = View.VISIBLE
    }

    private fun loadLookupIfNeeded() {
        if (lookup != null) return
        val token = tokenStore.getToken() ?: return
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { apiClient.customerLookup(token, phone, null) }
            result.onSuccess { json ->
                lookup = json
                bindHeader()
                bindInquiry()
                val inq = json.optJSONArray("inquiries")?.optJSONObject(0)
                val dateMs = intent.getLongExtra(EXTRA_DATE_MS, 0L)
                val duration = intent.getIntExtra(EXTRA_DURATION_SEC, 0)
                if (dateMs > 0) {
                    CallLogSync.syncKnownRow(
                        this@IncomingCallDetailActivity,
                        CallLogRow(0, phone, dateMs, duration, android.provider.CallLog.Calls.INCOMING_TYPE),
                        inq?.optString("id"),
                        json.optString("match"),
                    )
                }
                loadChangeHistory()
            }
        }
    }

    private fun loadCallHistory() {
        val token = tokenStore.getToken() ?: return
        val to = kstYmd()
        val from = kstYmd(System.currentTimeMillis() - 90L * 24 * 60 * 60 * 1000)
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { apiClient.listCallSessions(token, from, to, phone) }
            binding.callHistory.removeAllViews()
            result.onSuccess { items ->
                if (items.length() == 0) {
                    addCaption(binding.callHistory, getString(R.string.incoming_no_calls))
                    return@onSuccess
                }
                for (i in 0 until items.length()) {
                    val row = items.optJSONObject(i) ?: continue
                    val dir = if (row.optString("direction") == "INBOUND") "수신" else "발신"
                    val status = when (row.optString("status")) {
                        "CONNECTED" -> "연결"
                        "NO_ANSWER" -> "부재"
                        else -> "시도"
                    }
                    val at = TelecrmDateFormat.dateTime(row.optString("startedAt").ifBlank { row.optString("createdAt") })
                    val dur = row.optInt("durationSec", 0)
                    val line = buildString {
                        append("$at · $dir · $status")
                        if (dur > 0) append(" · ${dur}초")
                    }
                    addCaption(binding.callHistory, line)
                }
            }.onFailure {
                addCaption(binding.callHistory, it.message ?: getString(R.string.incoming_no_calls))
            }
        }
    }

    private fun loadChangeHistory() {
        val token = tokenStore.getToken() ?: return
        val inquiryId = lookup?.optJSONArray("inquiries")?.optJSONObject(0)?.optString("id").orEmpty()
        if (inquiryId.isBlank()) {
            binding.changeHistory.removeAllViews()
            addCaption(binding.changeHistory, getString(R.string.incoming_no_changes))
            return
        }
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { apiClient.getInquiry(token, inquiryId) }
            binding.changeHistory.removeAllViews()
            result.onSuccess { inquiry ->
                val logs = inquiry.optJSONArray("changeLogs") ?: JSONArray()
                if (logs.length() == 0) {
                    addCaption(binding.changeHistory, getString(R.string.incoming_no_changes))
                    return@onSuccess
                }
                var shown = 0
                for (i in 0 until logs.length()) {
                    if (shown >= 12) break
                    val log = logs.optJSONObject(i) ?: continue
                    val at = TelecrmDateFormat.dateTime(log.optString("createdAt"))
                    val actor = log.optJSONObject("actor")?.optString("name").orEmpty()
                    val lines = parseLines(log.opt("lines"))
                    val body = lines.joinToString(" · ").ifBlank { "변경" }
                    addCaption(binding.changeHistory, listOf(at, actor, body).filter { it.isNotBlank() }.joinToString(" · "))
                    shown += 1
                }
            }.onFailure {
                addCaption(binding.changeHistory, getString(R.string.incoming_no_changes))
            }
        }
    }

    private fun parseLines(raw: Any?): List<String> = when (raw) {
        is JSONArray -> buildList {
            for (i in 0 until raw.length()) add(raw.optString(i))
        }.filter { it.isNotBlank() }
        is String -> runCatching {
            val arr = JSONArray(raw)
            buildList { for (i in 0 until arr.length()) add(arr.optString(i)) }
        }.getOrElse { listOf(raw) }.filter { it.isNotBlank() }
        else -> emptyList()
    }

    private fun addCaption(parent: LinearLayout, text: String) {
        parent.addView(
            TextView(this).apply {
                this.text = text
                setTextAppearance(this@IncomingCallDetailActivity, R.style.TextAppearance_Telecrm_Caption)
                setPadding(0, (4 * resources.displayMetrics.density).toInt(), 0, 0)
            },
        )
    }

    private fun formatPhone(digits: String): String {
        if (digits.length == 11 && digits.startsWith("010")) {
            return "${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7)}"
        }
        return digits
    }

    private fun kstYmd(ms: Long = System.currentTimeMillis()): String {
        return Instant.ofEpochMilli(ms).atZone(ZoneId.of("Asia/Seoul")).format(DateTimeFormatter.ISO_LOCAL_DATE)
    }

    companion object {
        const val EXTRA_PHONE = "phone"
        const val EXTRA_DATE_MS = "date_ms"
        const val EXTRA_DURATION_SEC = "duration_sec"
        const val EXTRA_LOOKUP_JSON = "lookup_json"

        fun open(
            context: Context,
            phone: String,
            dateMs: Long = 0L,
            durationSec: Int = 0,
            lookup: JSONObject? = null,
        ) {
            context.startActivity(
                Intent(context, IncomingCallDetailActivity::class.java)
                    .putExtra(EXTRA_PHONE, phone)
                    .putExtra(EXTRA_DATE_MS, dateMs)
                    .putExtra(EXTRA_DURATION_SEC, durationSec)
                    .putExtra(EXTRA_LOOKUP_JSON, lookup?.toString()),
            )
        }
    }
}
