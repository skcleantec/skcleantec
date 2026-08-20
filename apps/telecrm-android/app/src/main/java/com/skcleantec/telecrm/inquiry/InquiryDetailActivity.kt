package com.skcleantec.telecrm.inquiry

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.skcleantec.telecrm.databinding.ActivityInquiryDetailBinding
import com.skcleantec.telecrm.ui.TelecrmInquiryLabels
import com.skcleantec.telecrm.ui.TelecrmLookupDetailRenderer
import org.json.JSONObject

class InquiryDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityInquiryDetailBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityInquiryDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.toolbar.setNavigationOnClickListener { finish() }

        val lookupJson = intent.getStringExtra(EXTRA_LOOKUP_JSON).orEmpty()
        val inquiryIndex = intent.getIntExtra(EXTRA_INQUIRY_INDEX, 0)
        val lookup = runCatching { JSONObject(lookupJson) }.getOrNull()
        if (lookup == null) {
            finish()
            return
        }

        val inq = lookup.optJSONArray("inquiries")?.optJSONObject(inquiryIndex)
        val titleName = inq?.optString("customerName").orEmpty()
        val status = TelecrmInquiryLabels.statusLabel(inq?.optString("status"))
        binding.toolbar.title = if (titleName.isNotBlank()) {
            "$titleName · $status"
        } else {
            getString(com.skcleantec.telecrm.R.string.inquiry_detail_title)
        }

        TelecrmLookupDetailRenderer.render(this, binding.detailContent, lookup, inquiryIndex)
    }

    companion object {
        const val EXTRA_LOOKUP_JSON = "lookup_json"
        const val EXTRA_INQUIRY_INDEX = "inquiry_index"

        fun open(context: Context, lookup: JSONObject, inquiryIndex: Int = 0) {
            context.startActivity(
                Intent(context, InquiryDetailActivity::class.java)
                    .putExtra(EXTRA_LOOKUP_JSON, lookup.toString())
                    .putExtra(EXTRA_INQUIRY_INDEX, inquiryIndex),
            )
        }
    }
}
