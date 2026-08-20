package com.skcleantec.telecrm.ui

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.skcleantec.telecrm.R
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

/** PC CRM customer-lookup 응답 → 모바일 접수 상세 섹션 */
object TelecrmLookupDetailRenderer {
    fun render(
        context: Context,
        container: LinearLayout,
        lookup: JSONObject,
        inquiryIndex: Int,
    ) {
        container.removeAllViews()
        val inquiries = lookup.optJSONArray("inquiries")
        val inq = inquiries?.optJSONObject(inquiryIndex)
        if (inq == null) {
            container.addView(bodyText(context, "표시할 접수가 없습니다."))
            return
        }

        val inquiryId = inq.optString("id")
        val customer = lookup.optJSONObject("customer")
        val match = TelecrmInquiryLabels.matchLabel(lookup.optString("match"))

        addSectionTitle(context, container, "고객")
        addField(context, container, "구분", match)
        addField(
            context,
            container,
            "이름",
            formatName(inq.optString("customerName"), inq.optString("nickname")),
        )
        addField(
            context,
            container,
            "전화",
            inq.optString("customerPhone").ifBlank { customer?.optString("phone").orEmpty() },
        )
        customer?.optString("lastAddress")?.takeIf { it.isNotBlank() }?.let {
            addField(context, container, "최근 주소", it)
        }

        addSectionTitle(context, container, "접수")
        addField(context, container, "상태", TelecrmInquiryLabels.statusLabel(inq.optString("status")))
        addField(context, container, "접수일", TelecrmDateFormat.dateTime(inq.optString("createdAt")))
        addField(context, container, "주소", inq.optString("address"))
        formatPyeong(inq)?.let { addField(context, container, "평수", it) }
        formatSchedule(inq)?.let { addField(context, container, "희망 일정", it) }
        inq.optString("specialNotes").takeIf { it.isNotBlank() }?.let {
            addField(context, container, "특이사항", it)
        }
        inq.optString("claimMemo").takeIf { it.isNotBlank() }?.let {
            addField(context, container, "클레임 메모", it)
        }
        inq.optString("memo").takeIf { it.isNotBlank() }?.let {
            addField(context, container, "메모", it)
        }

        renderOrderForm(context, container, inq)
        renderFollowups(context, container, lookup.optJSONArray("followups"), inquiryId)
        renderCsReports(context, container, lookup.optJSONArray("csReports"), inquiryId)
        renderLatestQuote(context, container, lookup.optJSONObject("latestQuote"), inquiryId)
    }

    fun summaryLines(inq: JSONObject, lookup: JSONObject): List<String> {
        val lines = mutableListOf<String>()
        lines += "${TelecrmInquiryLabels.statusLabel(inq.optString("status"))} · ${TelecrmDateFormat.dateTime(inq.optString("createdAt"))}"
        inq.optString("address").takeIf { it.isNotBlank() }?.let { lines += it }
        formatPyeong(inq)?.let { lines += it }
        formatSchedule(inq)?.let { lines += "희망 $it" }
        inq.optJSONObject("orderForm")?.optInt("totalAmount", 0)?.takeIf { it > 0 }?.let { total ->
            lines += "견적 ${won(total)}"
        }
        inq.optString("memo").takeIf { it.isNotBlank() }?.let { lines += it }
        val inquiryId = inq.optString("id")
        val followCount = countLinked(lookup.optJSONArray("followups"), inquiryId)
        val csCount = countLinked(lookup.optJSONArray("csReports"), inquiryId)
        if (followCount > 0 || csCount > 0) {
            lines += buildString {
                if (followCount > 0) append("후속 $followCount")
                if (followCount > 0 && csCount > 0) append(" · ")
                if (csCount > 0) append("C/S $csCount")
            }
        }
        return lines
    }

    private fun renderOrderForm(context: Context, container: LinearLayout, inq: JSONObject) {
        val orderForm = inq.optJSONObject("orderForm") ?: return
        val total = orderForm.optInt("totalAmount", 0)
        if (total <= 0 && orderForm.optString("submittedAt").isBlank()) return

        addSectionTitle(context, container, "발주서")
        orderForm.optString("submittedAt").takeIf { it.isNotBlank() }?.let {
            addField(context, container, "제출일", TelecrmDateFormat.dateTime(it))
        }
        if (total > 0) {
            addField(context, container, "총액", won(total))
            orderForm.optInt("depositAmount", 0).takeIf { it > 0 }?.let {
                addField(context, container, "예약금", won(it))
            }
            orderForm.optInt("balanceAmount", 0).takeIf { it > 0 }?.let {
                addField(context, container, "잔금", won(it))
            }
        }
        orderForm.optString("customerSpecialNotes").takeIf { it.isNotBlank() }?.let {
            addField(context, container, "고객 특이사항", it)
        }
        orderForm.optString("optionNote").takeIf { it.isNotBlank() }?.let {
            addField(context, container, "옵션 메모", it)
        }
        val answers = orderForm.optJSONArray("customAnswers")
        if (answers != null) {
            for (i in 0 until answers.length()) {
                val row = answers.optJSONObject(i) ?: continue
                val label = row.optString("label").ifBlank { row.optString("key") }
                val value = row.optString("value")
                if (label.isNotBlank() && value.isNotBlank()) {
                    addField(context, container, label, value)
                }
            }
        }
    }

    private fun renderFollowups(
        context: Context,
        container: LinearLayout,
        followups: JSONArray?,
        inquiryId: String,
    ) {
        val items = linkedItems(followups, inquiryId) ?: return
        addSectionTitle(context, container, "후속 DB")
        for (i in 0 until items.length()) {
            val row = items.getJSONObject(i)
            addBlock(
                context,
                container,
                buildString {
                    append(TelecrmInquiryLabels.statusLabel(row.optString("status")))
                    append(" · ")
                    append(TelecrmDateFormat.dateTime(row.optString("createdAt")))
                    row.optString("address").takeIf { it.isNotBlank() }?.let { append("\n$it") }
                    row.optString("memo").takeIf { it.isNotBlank() }?.let { append("\n$it") }
                },
            )
        }
    }

    private fun renderCsReports(
        context: Context,
        container: LinearLayout,
        csReports: JSONArray?,
        inquiryId: String,
    ) {
        val items = linkedItems(csReports, inquiryId) ?: return
        addSectionTitle(context, container, "C/S")
        for (i in 0 until items.length()) {
            val row = items.getJSONObject(i)
            addBlock(
                context,
                container,
                buildString {
                    append(TelecrmInquiryLabels.statusLabel(row.optString("status")))
                    append(" · ")
                    append(TelecrmDateFormat.dateTime(row.optString("createdAt")))
                    row.optString("content").takeIf { it.isNotBlank() }?.let { append("\n$it") }
                    row.optString("memo").takeIf { it.isNotBlank() }?.let { append("\n$it") }
                },
            )
        }
    }

    private fun renderLatestQuote(
        context: Context,
        container: LinearLayout,
        quote: JSONObject?,
        inquiryId: String,
    ) {
        if (quote == null) return
        val linkedId = quote.optString("inquiryId")
        if (linkedId.isNotBlank() && linkedId != inquiryId) return
        addSectionTitle(context, container, "상담 견적")
        addField(context, container, "상태", TelecrmInquiryLabels.statusLabel(quote.optString("status")))
        quote.optJSONObject("payload")?.optInt("grandTotalWon", 0)?.takeIf { it > 0 }?.let {
            addField(context, container, "합계", won(it))
        }
        quote.optJSONObject("payload")?.optString("copyText")?.takeIf { it.isNotBlank() }?.let {
            addField(context, container, "견적 요약", it)
        }
    }

    private fun linkedItems(array: JSONArray?, inquiryId: String): JSONArray? {
        if (array == null || array.length() == 0 || inquiryId.isBlank()) return null
        val out = JSONArray()
        for (i in 0 until array.length()) {
            val row = array.optJSONObject(i) ?: continue
            val linked = row.optString("inquiryId")
            if (linked.isBlank() || linked == inquiryId) out.put(row)
        }
        return if (out.length() == 0) null else out
    }

    private fun countLinked(array: JSONArray?, inquiryId: String): Int {
        val items = linkedItems(array, inquiryId) ?: return 0
        return items.length()
    }

    private fun formatName(name: String, nickname: String): String =
        if (nickname.isNotBlank()) "$name ($nickname)" else name

    private fun formatPyeong(inq: JSONObject): String? {
        val pyeong = inq.optDouble("areaPyeong", Double.NaN)
        if (pyeong.isNaN() || pyeong <= 0) return null
        return if (pyeong % 1.0 == 0.0) "${pyeong.toInt()}평" else "${pyeong}평"
    }

    private fun formatSchedule(inq: JSONObject): String? {
        val date = inq.optString("preferredDate").takeIf { it.isNotBlank() }
        val time = inq.optString("preferredTime").takeIf { it.isNotBlank() }
        return when {
            date != null && time != null -> "$date $time"
            date != null -> date
            time != null -> time
            else -> null
        }
    }

    private fun won(amount: Int): String =
        "${NumberFormat.getNumberInstance(Locale.KOREA).format(amount)}원"

    private fun addSectionTitle(context: Context, container: LinearLayout, title: String) {
        container.addView(TextView(context).apply {
            text = title
            setTextAppearance(R.style.TextAppearance_Telecrm_SectionLabel)
            setPadding(0, dp(context, 14), 0, dp(context, 6))
        })
    }

    private fun addField(context: Context, container: LinearLayout, label: String, value: String) {
        if (value.isBlank()) return
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(context, 4), 0, dp(context, 4))
        }
        row.addView(TextView(context).apply {
            text = label
            setTextColor(color(context, R.color.slate_500))
            textSize = 12f
            minWidth = dp(context, 72)
        })
        row.addView(TextView(context).apply {
            text = value
            setTextColor(color(context, R.color.slate_800))
            textSize = 13f
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        })
        container.addView(row)
    }

    private fun addBlock(context: Context, container: LinearLayout, text: String) {
        container.addView(TextView(context).apply {
            this.text = text
            setTextColor(color(context, R.color.slate_700))
            textSize = 13f
            setLineSpacing(dp(context, 2).toFloat(), 1f)
            setPadding(0, dp(context, 4), 0, dp(context, 8))
            setTypeface(typeface, Typeface.NORMAL)
        })
    }

    private fun bodyText(context: Context, text: String) = TextView(context).apply {
        this.text = text
        setTextColor(color(context, R.color.slate_600))
        textSize = 14f
        gravity = Gravity.CENTER
        setPadding(0, dp(context, 24), 0, dp(context, 24))
    }

    private fun color(context: Context, id: Int) = ContextCompat.getColor(context, id)

    private fun dp(context: Context, v: Int) = (v * context.resources.displayMetrics.density).toInt()
}
