package com.skcleantec.telecrm.realtime

import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class InboxWebSocketClient(
    private val onMessagePayload: (JSONObject) -> Unit = { AppEventBus.handlePayload(it) },
) {
    private val client = OkHttpClient.Builder()
        .pingInterval(25, TimeUnit.SECONDS)
        .build()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var webSocket: WebSocket? = null
    private var token: String? = null
    private var activeBaseUrl: String? = null
    private var closed = false
    private var reconnectRunnable: Runnable? = null

    fun connect(jwt: String, apiBaseUrl: String) {
        if (token == jwt && webSocket != null && activeBaseUrl == apiBaseUrl) return
        disconnect()
        token = jwt
        activeBaseUrl = apiBaseUrl
        closed = false
        openSocket(jwt, apiBaseUrl)
    }

    fun disconnect() {
        closed = true
        reconnectRunnable?.let { mainHandler.removeCallbacks(it) }
        reconnectRunnable = null
        webSocket?.close(1000, "logout")
        webSocket = null
        token = null
        activeBaseUrl = null
        AppEventBus.emitConnection(false)
    }

    private fun openSocket(jwt: String, apiBaseUrl: String) {
        val encoded = URLEncoder.encode(jwt, Charsets.UTF_8.name())
        val wsBase = apiBaseUrl
            .replace("https://", "wss://")
            .replace("http://", "ws://")
        val request = Request.Builder().url("$wsBase/ws?token=$encoded&client=telecrm-app").build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                mainHandler.post { AppEventBus.emitConnection(true) }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching {
                    val json = JSONObject(text)
                    mainHandler.post { onMessagePayload(json) }
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                mainHandler.post {
                    AppEventBus.emitConnection(false)
                    scheduleReconnect(code)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                mainHandler.post {
                    AppEventBus.emitConnection(false)
                    scheduleReconnect(null)
                }
            }
        })
    }

    private fun scheduleReconnect(closeCode: Int?) {
        if (closed) return
        if (closeCode == 4001 || closeCode == 4002) return
        val jwt = token ?: return
        val base = activeBaseUrl ?: return
        reconnectRunnable?.let { mainHandler.removeCallbacks(it) }
        reconnectRunnable = Runnable {
            if (!closed && token == jwt) openSocket(jwt, base)
        }
        mainHandler.postDelayed(reconnectRunnable!!, 3000)
    }
}
