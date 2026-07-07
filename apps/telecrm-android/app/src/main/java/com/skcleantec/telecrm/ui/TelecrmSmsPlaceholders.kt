package com.skcleantec.telecrm.ui

data class TelecrmSmsPlaceholderCtx(
    val customerName: String? = null,
    val phone: String = "",
    val pyeong: String? = null,
    val estimate: String? = null,
    val orderLink: String? = null,
)

object TelecrmSmsPlaceholders {
    fun apply(body: String, ctx: TelecrmSmsPlaceholderCtx): String =
        body
            .replace("{고객명}", ctx.customerName?.trim()?.takeIf { it.isNotBlank() } ?: "고객님")
            .replace("{연락처}", ctx.phone.trim().takeIf { it.isNotBlank() } ?: "—")
            .replace("{평수}", ctx.pyeong?.trim()?.takeIf { it.isNotBlank() } ?: "—")
            .replace("{예상가}", ctx.estimate?.trim()?.takeIf { it.isNotBlank() } ?: "—")
            .replace("{발주서링크}", ctx.orderLink?.trim()?.takeIf { it.isNotBlank() } ?: "(발주서 링크 없음)")
}
