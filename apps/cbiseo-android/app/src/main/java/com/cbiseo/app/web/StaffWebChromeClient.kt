package com.cbiseo.app.web

import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.os.Message
import android.webkit.JsResult
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * 팀장 앱 WebView는 파일 선택·새 창이 없으면 계약 셀카와 「계약하기」가 동작하지 않는다.
 */
class StaffWebChromeClient(
    private val launchFileChooser: (Intent) -> Unit,
    private val onBlankNavigation: (String) -> Unit,
) : WebChromeClient() {
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    fun cancelFileChooser() {
        fileCallback?.onReceiveValue(null)
        fileCallback = null
    }

    fun onFileChooserResult(resultCode: Int, data: Intent?) {
        val callback = fileCallback
        fileCallback = null
        callback?.onReceiveValue(FileChooserParams.parseResult(resultCode, data))
    }

    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?,
    ): Boolean {
        fileCallback?.onReceiveValue(null)
        fileCallback = filePathCallback
        val accept = fileChooserParams?.acceptTypes
            ?.firstOrNull { it.isNotBlank() && it != "*/*" }
            ?: "image/*"
        val content = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = accept
        }
        val chooser = Intent.createChooser(content, "사진 선택")
        return try {
            launchFileChooser(chooser)
            true
        } catch (_: ActivityNotFoundException) {
            fileCallback = null
            filePathCallback?.onReceiveValue(null)
            false
        }
    }

    override fun onCreateWindow(
        view: WebView?,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message?,
    ): Boolean {
        if (view == null || resultMsg == null) return false
        val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
        val popup = WebView(view.context)
        popup.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(popupView: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString().orEmpty()
                if (url.startsWith("https://") || url.startsWith("http://")) {
                    onBlankNavigation(url)
                }
                popupView?.post { popupView.destroy() }
                return true
            }
        }
        transport.webView = popup
        resultMsg.sendToTarget()
        return true
    }

    /**
     * 기본 WebChromeClient는 confirm을 바로 취소한다.
     * 정보공유 「인계 확정」처럼 window.confirm을 쓰는 버튼이 앱에서 눌려도 아무 일이 없다.
     */
    override fun onJsConfirm(
        view: WebView?,
        url: String?,
        message: String?,
        result: JsResult?,
    ): Boolean {
        val activity = findActivity(view) ?: return false
        activity.runOnUiThread {
            AlertDialog.Builder(activity)
                .setMessage(message.orEmpty())
                .setPositiveButton(android.R.string.ok) { _, _ -> result?.confirm() }
                .setNegativeButton(android.R.string.cancel) { _, _ -> result?.cancel() }
                .setOnCancelListener { result?.cancel() }
                .show()
        }
        return true
    }

    override fun onJsAlert(
        view: WebView?,
        url: String?,
        message: String?,
        result: JsResult?,
    ): Boolean {
        val activity = findActivity(view) ?: return false
        activity.runOnUiThread {
            AlertDialog.Builder(activity)
                .setMessage(message.orEmpty())
                .setPositiveButton(android.R.string.ok) { _, _ -> result?.confirm() }
                .setOnCancelListener { result?.confirm() }
                .show()
        }
        return true
    }

    private fun findActivity(view: WebView?): Activity? {
        var ctx = view?.context
        while (ctx is ContextWrapper) {
            if (ctx is Activity) return ctx
            ctx = ctx.baseContext
        }
        return null
    }
}
