package com.skcleantec.telecrm.service

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.content.ContextCompat
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.api.ApiEnvironment
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.realtime.AppEventBus
import com.skcleantec.telecrm.realtime.InboxWebSocketClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** PC CRM dispatch 수신 — Foreground Service(WebSocket + 폴링) */
class TelecrmRealtimeService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val tokenStore by lazy { TokenStore.get(this) }
    private val apiClient by lazy { ApiClient.fromContext(this) }
    private val webSocketClient = InboxWebSocketClient { json ->
        when (json.optString("type")) {
            "telecrm:dispatch" -> TelecrmDispatchRouter.route(this, TelecrmDispatchRouter.fromJson(json))
            else -> AppEventBus.handlePayload(json)
        }
    }
    private var pollJob: Job? = null
    private var drainJob: Job? = null
    private var wsConnected = false
    private var sessionToken: String? = null
    private var sessionApiBaseUrl: String? = null

    /** WS는 AppEventBus로 이미 emit — 여기서 재emit하면 리스너 무한 루프·ANR */
    private val connectionListener: (Boolean) -> Unit = { connected ->
        wsConnected = connected
        updateOngoingNotification()
        if (connected) scheduleDrain()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        TelecrmNotificationHelper.ensureChannels(this)
        AppEventBus.addConnectionListener(connectionListener)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
        }

        val token = tokenStore.getToken()
        if (token.isNullOrBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        val apiBaseUrl = ApiEnvironment.resolveForUser(tokenStore.getLoginId(), tokenStore.getApiBaseUrl())

        startForeground(
            TelecrmNotificationHelper.NOTIFICATION_ONGOING,
            TelecrmNotificationHelper.buildOngoingNotification(this, wsConnected),
        )

        val sameSession = sessionToken == token && sessionApiBaseUrl == apiBaseUrl
        if (sameSession) {
            if (!webSocketClient.isConnected()) {
                webSocketClient.connect(token, apiBaseUrl)
            }
            return START_STICKY
        }

        sessionToken = token
        sessionApiBaseUrl = apiBaseUrl
        webSocketClient.connect(token, apiBaseUrl)
        startPolling()
        scheduleDrain()

        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        pollJob?.cancel()
        drainJob?.cancel()
        scope.cancel()
        AppEventBus.removeConnectionListener(connectionListener)
        webSocketClient.disconnect()
        sessionToken = null
        sessionApiBaseUrl = null
        super.onDestroy()
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = scope.launch {
            while (isActive) {
                val interval = if (wsConnected) POLL_INTERVAL_CONNECTED_MS else POLL_INTERVAL_DISCONNECTED_MS
                delay(interval)
                scheduleDrain()
            }
        }
    }

    private fun updateOngoingNotification() {
        val notification = TelecrmNotificationHelper.buildOngoingNotification(this, wsConnected)
        val manager = getSystemService(NotificationManager::class.java)
        if (manager != null) {
            manager.notify(TelecrmNotificationHelper.NOTIFICATION_ONGOING, notification)
        } else {
            startForeground(TelecrmNotificationHelper.NOTIFICATION_ONGOING, notification)
        }
    }

    /** 동시 drain 1건만 — EncryptedSharedPreferences·HTTP 폭주 방지 */
    private fun scheduleDrain() {
        if (drainJob?.isActive == true) return
        drainJob = scope.launch {
            val token = tokenStore.getToken() ?: return@launch
            val result = withContext(Dispatchers.IO) {
                apiClient.fetchPendingMobileDispatches(token)
            }
            result.onSuccess { items ->
                val nonCalls = items.filter { it.action != "call" }
                val latestCall = items.lastOrNull { it.action == "call" }
                val toProcess = nonCalls + listOfNotNull(latestCall)
                toProcess.forEach { item ->
                    TelecrmDispatchRouter.route(
                        this@TelecrmRealtimeService,
                        AppEventBus.DispatchPayload(
                            id = item.id,
                            action = item.action,
                            phone = item.phone,
                            body = item.body,
                            imageUrl = item.imageUrl,
                            inquiryId = item.inquiryId,
                            customerMatch = item.customerMatch,
                            targetUserId = item.targetUserId,
                            broadcastToTenant = false,
                        ),
                    )
                }
            }
        }
    }

    companion object {
        private const val ACTION_START = "com.skcleantec.telecrm.action.START_REALTIME"
        private const val ACTION_STOP = "com.skcleantec.telecrm.action.STOP_REALTIME"
        private const val POLL_INTERVAL_CONNECTED_MS = 8000L
        private const val POLL_INTERVAL_DISCONNECTED_MS = 5000L

        @Volatile
        var isRunning: Boolean = false
            private set

        fun start(context: Context) {
            val intent = Intent(context, TelecrmRealtimeService::class.java).apply {
                action = ACTION_START
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.startService(
                Intent(context, TelecrmRealtimeService::class.java).apply {
                    action = ACTION_STOP
                },
            )
        }
    }
}
