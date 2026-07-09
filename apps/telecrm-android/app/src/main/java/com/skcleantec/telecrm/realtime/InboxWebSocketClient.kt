package com.skcleantec.telecrm.realtime

import android.os.Handler
import android.os.Looper
import com.skcleantec.telecrm.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class InboxWebSocketClient {
    private val client = OkHttpClient.Builder()
        .pingInterval(25, TimeUnit.SECONDS)
        .build()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var webSocket: WebSocket? = null
    private var token: String? = null
    private var closed = false
    private var reconnectRunnable: Runnable? = null

    fun connect(jwt: String) {
        if (token == jwt && webSocket != null) return
        disconnect()
        token = jwt
        closed = false
        openSocket(jwt)
    }

    fun disconnect() {
        closed = true
        reconnectRunnable?.let { mainHandler.removeCallbacks(it) }
        reconnectRunnable = null
        webSocket?.close(1000, "logout")
        webSocket = null
        token = null
        AppEventBus.emitConnection(false)
    }

    private fun openSocket(jwt: String) {
        val encoded = URLEncoder.encode(jwt, Charsets.UTF_8.name())
        val wsBase = BuildConfig.API_BASE_URL
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
                    mainHandler.post { AppEventBus.handlePayload(json) }
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
        reconnectRunnable?.let { mainHandler.removeCallbacks(it) }
        reconnectRunnable = Runnable {
            if (!closed && token == jwt) openSocket(jwt)
        }
        mainHandler.postDelayed(reconnectRunnable!!, 3000)
    }
}
