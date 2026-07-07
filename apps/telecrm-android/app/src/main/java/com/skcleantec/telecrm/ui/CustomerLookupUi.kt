package com.skcleantec.telecrm.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.skcleantec.telecrm.R
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

class CustomerLookupState {
    var match: String = "unknown"
    var selectedPhone: String = ""
    var selectedInquiryId: String? = null
    var customerName: String = ""
    var areaPyeong: String = ""
    var estimateWon: Int? = null
    var orderLink: String? = null
}

object CustomerLookupUi {
    fun clear(
        candidatesContainer: LinearLayout,
        inquiriesContainer: LinearLayout,
        actionRow: View,
        state: CustomerLookupState,
    ) {
        candidatesContainer.removeAllViews()
        candidatesContainer.visibility = View.GONE
        inquiriesContainer.removeAllViews()
        inquiriesContainer.visibility = View.GONE
        actionRow.visibility = View.GONE
        state.selectedInquiryId = null
        state.customerName = ""
        state.areaPyeong = ""
        state.estimateWon = null
        state.orderLink = null
    }

    private fun applyInquiryToState(state: CustomerLookupState, inq: JSONObject) {
        state.selectedInquiryId = inq.optString("id").takeIf { it.isNotBlank() }
        state.selectedPhone = inq.optString("customerPhone").ifBlank { state.selectedPhone }
        state.customerName = inq.optString("customerName")
        val pyeong = inq.optDouble("areaPyeong", Double.NaN)
        state.areaPyeong = if (!pyeong.isNaN() && pyeong > 0) {
            if (pyeong % 1.0 == 0.0) "${pyeong.toInt()}평" else "${pyeong}평"
        } else {
            ""
        }
        state.estimateWon = inq.optJSONObject("orderForm")?.optInt("totalAmount", 0)?.takeIf { it > 0 }
        state.orderLink = null
    }

    fun render(
        context: Context,
        json: JSONObject,
        phoneFallback: String,
        candidatesContainer: LinearLayout,
        inquiriesContainer: LinearLayout,
        actionRow: View,
        state: CustomerLookupState,
        onPickSearch: (phone: String, name: String) -> Unit,
    ) {
        state.match = json.optString("match", "unknown")
        val customer = json.optJSONObject("customer")
        state.selectedPhone = customer?.optString("phone").orEmpty()
            .ifBlank { phoneFallback.filter { it.isDigit() } }

        when (state.match) {
            "pick" -> renderCandidates(context, json.optJSONArray("candidates"), candidatesContainer, onPickSearch)
            else -> {
                candidatesContainer.visibility = View.GONE
                renderInquiries(context, json.optJSONArray("inquiries"), inquiriesContainer, state)
            }
        }
        if (state.selectedPhone.isNotBlank()) actionRow.visibility = View.VISIBLE
    }

    private fun renderCandidates(
        context: Context,
        candidates: JSONArray?,
        container: LinearLayout,
        onPickSearch: (phone: String, name: String) -> Unit,
    ) {
        container.removeAllViews()
        if (candidates == null || candidates.length() == 0) {
            container.visibility = View.GONE
            return
        }
        container.visibility = View.VISIBLE
        container.addView(sectionTitle(context, "동명이인 — 선택"))
        for (i in 0 until candidates.length()) {
            val c = candidates.getJSONObject(i)
            val btn = MaterialButton(context, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply { bottomMargin = dp(context, 8) }
                text = buildString {
                    append(c.optString("customerName"))
                    c.optString("nickname").takeIf { it.isNotBlank() }?.let { append(" ($it)") }
                    append("\n")
                    append(c.optString("customerPhone"))
                }
                gravity = Gravity.START
                setTextColor(color(context, R.color.slate_700))
                strokeColor = ColorStateList.valueOf(color(context, R.color.slate_300))
                cornerRadius = dp(context, 12)
                setOnClickListener {
                    onPickSearch(c.optString("customerPhone"), c.optString("customerName"))
                }
            }
            container.addView(btn)
        }
    }

    private fun renderInquiries(
        context: Context,
        inquiries: JSONArray?,
        container: LinearLayout,
        state: CustomerLookupState,
    ) {
        container.removeAllViews()
        val label = when (state.match) {
            "existing" -> "기존 고객"
            "new" -> "신규 고객"
            else -> "고객"
        }
        container.addView(sectionTitle(context, label))
        if (inquiries == null || inquiries.length() == 0) {
            container.addView(TextView(context).apply {
                text = if (state.match == "new") "접수 이력 없음" else "표시할 접수 없음"
                setTextColor(color(context, R.color.slate_500))
                textSize = 13f
            })
            container.visibility = View.VISIBLE
            state.selectedInquiryId = null
            return
        }
        container.visibility = View.VISIBLE
        for (i in 0 until inquiries.length()) {
            val inq = inquiries.getJSONObject(i)
            if (i == 0) applyInquiryToState(state, inq)
            container.addView(buildInquiryCard(context, inq, i == 0, state))
        }
    }

    private fun buildInquiryCard(
        context: Context,
        inq: JSONObject,
        selected: Boolean,
        state: CustomerLookupState,
    ): MaterialCardView {
        return MaterialCardView(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(context, 8) }
            radius = dp(context, 16).toFloat()
            setCardBackgroundColor(
                color(context, if (selected) R.color.blue_50 else R.color.white),
            )
            strokeColor = color(context, R.color.slate_200)
            strokeWidth = dp(context, 1)
            setContentPadding(dp(context, 14), dp(context, 14), dp(context, 14), dp(context, 14))
            setOnClickListener {
                applyInquiryToState(state, inq)
            }
            val col = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
            val name = inq.optString("customerName")
            val nick = inq.optString("nickname")
            col.addView(TextView(context).apply {
                text = if (nick.isNotBlank()) "$name ($nick)" else name
                setTextColor(color(context, R.color.slate_900))
                textSize = 15f
                setTypeface(typeface, Typeface.BOLD)
            })
            col.addView(TextView(context).apply {
                text = "${inq.optString("customerPhone")} · ${inq.optString("status")}"
                setTextColor(color(context, R.color.slate_500))
                textSize = 12f
            })
            inq.optString("address").takeIf { it.isNotBlank() }?.let {
                col.addView(TextView(context).apply {
                    text = it
                    setTextColor(color(context, R.color.slate_600))
                    textSize = 12f
                })
            }
            inq.optJSONObject("orderForm")?.optInt("totalAmount", 0)?.takeIf { it > 0 }?.let { total ->
                col.addView(TextView(context).apply {
                    text = "견적 ${NumberFormat.getNumberInstance(Locale.KOREA).format(total)}원"
                    setTextColor(color(context, R.color.emerald_600))
                    textSize = 13f
                })
            }
            inq.optString("memo").takeIf { it.isNotBlank() }?.let {
                col.addView(TextView(context).apply {
                    text = it
                    setTextColor(color(context, R.color.slate_700))
                    textSize = 13f
                    maxLines = 3
                })
            }
            addView(col)
        }
    }

    private fun sectionTitle(context: Context, text: String) = TextView(context).apply {
        this.text = text
        setTextColor(color(context, R.color.slate_400))
        textSize = 11f
        letterSpacing = 0.06f
        setAllCaps(true)
        setPadding(0, 0, 0, dp(context, 8))
    }

    private fun color(context: Context, id: Int) = ContextCompat.getColor(context, id)

    private fun dp(context: Context, v: Int) = (v * context.resources.displayMetrics.density).toInt()
}
