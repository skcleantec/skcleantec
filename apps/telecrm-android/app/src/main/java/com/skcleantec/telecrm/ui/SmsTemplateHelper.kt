package com.skcleantec.telecrm.ui

import android.content.Context
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.api.SmsTemplateDto
import com.skcleantec.telecrm.telephony.TelecrmCallHelper
import java.text.NumberFormat
import java.util.Locale
import org.json.JSONObject

object SmsTemplateHelper {
    fun placeholderCtxFromLookup(phone: String, lookup: JSONObject?): TelecrmSmsPlaceholderCtx {
        if (lookup == null) {
            return TelecrmSmsPlaceholderCtx(phone = phone.filter { it.isDigit() })
        }
        val inq = lookup.optJSONArray("inquiries")?.optJSONObject(0)
        val customer = lookup.optJSONObject("customer")
        val name = inq?.optString("customerName")?.takeIf { it.isNotBlank() }
            ?: customer?.optString("name")?.takeIf { it.isNotBlank() }
        val pyeong = inq?.optDouble("areaPyeong", Double.NaN)?.takeIf { !it.isNaN() && it > 0 }
            ?.let { if (it % 1.0 == 0.0) "${it.toInt()}평" else "${it}평" }
        val total = inq?.optJSONObject("orderForm")?.optInt("totalAmount", 0)?.takeIf { it > 0 }
        val estimate = total?.let { "${NumberFormat.getNumberInstance(Locale.KOREA).format(it)}원" }
        return TelecrmSmsPlaceholderCtx(
            customerName = name,
            phone = phone.filter { it.isDigit() },
            pyeong = pyeong,
            estimate = estimate,
        )
    }

    fun placeholderCtxFromState(phone: String, state: CustomerLookupState): TelecrmSmsPlaceholderCtx {
        val estimate = state.estimateWon?.takeIf { it > 0 }
            ?.let { "${NumberFormat.getNumberInstance(Locale.KOREA).format(it)}원" }
        return TelecrmSmsPlaceholderCtx(
            customerName = state.customerName.takeIf { it.isNotBlank() },
            phone = phone.filter { it.isDigit() },
            pyeong = state.areaPyeong.takeIf { it.isNotBlank() },
            estimate = estimate,
            orderLink = state.orderLink,
        )
    }

    fun bindTemplateChips(
        context: Context,
        container: LinearLayout,
        emptyView: TextView?,
        templates: List<SmsTemplateDto>,
        onSelect: (SmsTemplateDto) -> Unit,
    ) {
        container.removeAllViews()
        if (templates.isEmpty()) {
            emptyView?.visibility = View.VISIBLE
            return
        }
        emptyView?.visibility = View.GONE
        templates.forEach { template ->
            val chip = MaterialButton(
                context,
                null,
                com.google.android.material.R.attr.materialButtonOutlinedStyle,
            ).apply {
                text = template.label
                isAllCaps = false
                textSize = 13f
                setTextColor(ContextCompat.getColor(context, R.color.slate_700))
                strokeColor = ContextCompat.getColorStateList(context, R.color.slate_300)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply {
                    marginEnd = dp(context, 8)
                }
                setOnClickListener { onSelect(template) }
            }
            container.addView(chip)
        }
    }

    fun sendTemplate(
        context: Context,
        phone: String,
        template: SmsTemplateDto,
        ctx: TelecrmSmsPlaceholderCtx,
    ) {
        val digits = phone.filter { it.isDigit() }
        if (digits.length < 8) {
            Toast.makeText(context, "전화번호(8자 이상)를 입력해 주세요.", Toast.LENGTH_SHORT).show()
            return
        }
        val body = TelecrmSmsPlaceholders.apply(template.body, ctx.copy(phone = digits))
        TelecrmCallHelper.openSms(context, digits, body, template.imageUrl)
    }

    suspend fun enrichOrderLink(apiClient: ApiClient, token: String, ctx: TelecrmSmsPlaceholderCtx, inquiryId: String?): TelecrmSmsPlaceholderCtx {
        val id = inquiryId?.takeIf { it.isNotBlank() } ?: return ctx
        if (!ctx.orderLink.isNullOrBlank()) return ctx
        val link = apiClient.getOrderFormLink(token, id).getOrNull()
        return if (link.isNullOrBlank()) ctx else ctx.copy(orderLink = link)
    }

    private fun dp(context: Context, v: Int) = (v * context.resources.displayMetrics.density).toInt()
}
