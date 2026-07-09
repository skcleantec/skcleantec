package com.skcleantec.telecrm.service

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
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val webSocketClient = InboxWebSocketClient { json ->
        when (json.optString("type")) {
            "telecrm:dispatch" -> TelecrmDispatchRouter.route(this, TelecrmDispatchRouter.fromJson(json))
            else -> AppEventBus.handlePayload(json)
        }
    }
    private var pollJob: Job? = null
    private var wsConnected = false

    private val connectionListener: (Boolean) -> Unit = { connected ->
        wsConnected = connected
        refreshForegroundNotification()
        AppEventBus.emitConnection(connected)
        if (connected) drainPendingDispatches()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
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

        val tokenStore = TokenStore(this)
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

        webSocketClient.connect(token, apiBaseUrl)
        startPolling()
        drainPendingDispatches()

        return START_STICKY
    }

    override fun onDestroy() {
        pollJob?.cancel()
        scope.cancel()
        AppEventBus.removeConnectionListener(connectionListener)
        webSocketClient.disconnect()
        super.onDestroy()
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = scope.launch {
            while (isActive) {
                delay(POLL_INTERVAL_MS)
                drainPendingDispatches()
            }
        }
    }

    private fun refreshForegroundNotification() {
        val notification = TelecrmNotificationHelper.buildOngoingNotification(this, wsConnected)
        startForeground(TelecrmNotificationHelper.NOTIFICATION_ONGOING, notification)
    }

    private fun drainPendingDispatches() {
        val tokenStore = TokenStore(this)
        val token = tokenStore.getToken() ?: return
        val apiClient = ApiClient.fromContext(this)

        scope.launch {
            val result = withContext(Dispatchers.IO) {
                apiClient.fetchPendingMobileDispatches(token)
            }
            result.onSuccess { items ->
                items.forEach { item ->
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
                        ),
                    )
                }
            }
        }
    }

    companion object {
        private const val ACTION_START = "com.skcleantec.telecrm.action.START_REALTIME"
        private const val ACTION_STOP = "com.skcleantec.telecrm.action.STOP_REALTIME"
        private const val POLL_INTERVAL_MS = 1000L

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
