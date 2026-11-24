package com.cbiseo.depositalert.ui

import android.Manifest
import android.content.ComponentName
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.cbiseo.depositalert.BuildConfig
import com.cbiseo.depositalert.data.DepositDatabase
import com.cbiseo.depositalert.databinding.ActivityMainBinding
import com.cbiseo.depositalert.net.DepositApi
import com.cbiseo.depositalert.net.RegisterReply
import com.cbiseo.depositalert.service.KeepAliveService
import com.cbiseo.depositalert.sms.DropReason
import com.cbiseo.depositalert.sms.InboxScan
import com.cbiseo.depositalert.R
import com.cbiseo.depositalert.sms.MessageNoticeReader
import com.cbiseo.depositalert.sms.SAMPLE_NH_SMS
import com.cbiseo.depositalert.sms.formatNoticeLine
import com.cbiseo.depositalert.sms.previewDeposit
import com.cbiseo.depositalert.store.DeviceSettings
import com.cbiseo.depositalert.store.NoticeLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var settings: DeviceSettings
    private val ui = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var refreshJob: Job? = null
    private var suppressSwitch = false
    private val seoul = ZoneId.of("Asia/Seoul")
    private val prefListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
        runOnUiThread { if (!isFinishing) render() }
    }

    private val askSms = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        render()
    }
    private val askReadSms = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        if (it) ui.launch(Dispatchers.IO) { InboxScan.run(applicationContext) }
        render()
    }
    private val askNotice = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        render()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        settings = DeviceSettings(this)
        binding.serverProduction.isChecked = settings.serverBase() != DeviceSettings.STAGING
        binding.serverStaging.isChecked = settings.serverBase() == DeviceSettings.STAGING
        binding.pairButton.setOnClickListener { pair() }
        binding.listeningSwitch.setOnCheckedChangeListener { _, checked -> onListening(checked) }
        binding.messageNoticeSwitch.setOnCheckedChangeListener { _, checked -> onMessageNotice(checked) }
        binding.messageNoticePermission.setOnClickListener { openMessageNoticeAccess() }
        binding.smsPermission.setOnClickListener { askSms.launch(Manifest.permission.RECEIVE_SMS) }
        binding.noticePermission.setOnClickListener { openNotifications() }
        binding.batteryPermission.setOnClickListener { openBattery() }
        binding.samsungBattery.setOnClickListener { openBattery() }
        binding.sampleButton.setOnClickListener { showSample() }
        binding.scanButton.setOnClickListener { scanInbox() }
        binding.noticeRescan.setOnClickListener { rescanNotices() }
        binding.noticeWarning.setOnClickListener { openMessageNoticeAccess() }
        binding.readSmsPermission.setOnClickListener { scanInbox() }
        binding.disconnectButton.setOnClickListener { disconnect() }
    }

    override fun onResume() {
        super.onResume()
        settings.listen(prefListener)
        render()
        if (settings.messageNotice() && !messageNoticeAllowed() && !settings.noticeAccessPrompted()) {
            settings.markNoticeAccessPrompted()
            openMessageNoticeAccess()
        }
        ui.launch(Dispatchers.IO) {
            InboxScan.run(applicationContext)
            MessageNoticeReader.maintain(applicationContext)
        }
    }

    override fun onPause() {
        settings.unlisten(prefListener)
        super.onPause()
    }

    override fun onDestroy() {
        ui.cancel()
        super.onDestroy()
    }

    private fun pair() {
        val code = binding.codeInput.text?.toString()?.trim().orEmpty()
        if (!Regex("^\\d{6}$").matches(code)) {
            showPairError("연결 코드 6자리를 입력해 주세요.")
            return
        }
        val base = if (binding.serverStaging.isChecked) DeviceSettings.STAGING else DeviceSettings.PRODUCTION
        settings.setServerBase(base)
        binding.pairButton.isEnabled = false
        ui.launch {
            val reply = withContext(Dispatchers.IO) {
                DepositApi().register(base, code, deviceLabel(), BuildConfig.VERSION_NAME)
            }
            binding.pairButton.isEnabled = true
            binding.codeInput.setText("")
            when (reply) {
                is RegisterReply.Ok -> {
                    settings.saveToken(reply.token)
                    settings.setListening(true)
                    KeepAliveService.start(this@MainActivity)
                    showPairError(null)
                    render()
                }
                is RegisterReply.Fail -> showPairError(reply.message)
            }
        }
    }

    private fun onListening(checked: Boolean) {
        if (suppressSwitch) return
        if (checked && !settings.hasToken()) {
            binding.listeningSwitch.isChecked = false
            showPairError("먼저 연결 코드를 입력해 주세요.")
            return
        }
        if (checked && !smsGranted()) {
            binding.listeningSwitch.isChecked = false
            askSms.launch(Manifest.permission.RECEIVE_SMS)
            return
        }
        settings.setListening(checked)
        if (checked) KeepAliveService.start(this) else KeepAliveService.stop(this)
        render()
    }

    private fun onMessageNotice(checked: Boolean) {
        if (suppressSwitch) return
        settings.setMessageNotice(checked)
        if (checked && !messageNoticeAllowed()) {
            openMessageNoticeAccess()
        } else if (checked) {
            NotificationListenerService.requestRebind(ComponentName(this, MessageNoticeReader::class.java))
        }
        render()
    }

    private fun openMessageNoticeAccess() {
        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    private fun disconnect() {
        settings.clearToken()
        KeepAliveService.stop(this)
        ui.launch {
            withContext(Dispatchers.IO) { DepositDatabase.get(this@MainActivity).pending().clear() }
            render()
        }
    }

    private fun rescanNotices() {
        if (!messageNoticeAllowed()) {
            openMessageNoticeAccess()
            return
        }
        ui.launch(Dispatchers.IO) { MessageNoticeReader.maintain(applicationContext) }
    }

    private fun scanInbox() {
        if (!readSmsGranted()) {
            askReadSms.launch(Manifest.permission.READ_SMS)
            return
        }
        ui.launch(Dispatchers.IO) { InboxScan.run(applicationContext) }
    }

    private fun showSample() {
        val preview = previewDeposit("15882100", SAMPLE_NH_SMS, System.currentTimeMillis())
        binding.sampleResult.text = if (!preview.forward) {
            "보내지 않음. 입금·농협이 아니거나 출금·결제·광고입니다."
        } else {
            "보낼 문자입니다. 서버로는 나가지 않습니다.\n금액 ${preview.amountLabel.ifBlank { "없음" }} · ${preview.depositorName.ifBlank { "이름 없음" }}\n잔액을 지운 본문:\n${preview.stripped}"
        }
    }

    private fun render() {
        val paired = settings.hasToken()
        binding.pairBox.visibility = if (paired) View.GONE else View.VISIBLE
        binding.disconnectButton.visibility = if (paired) View.VISIBLE else View.GONE
        if (binding.listeningSwitch.isChecked != settings.listening()) {
            suppressSwitch = true
            binding.listeningSwitch.isChecked = settings.listening()
            suppressSwitch = false
        }
        if (binding.messageNoticeSwitch.isChecked != settings.messageNotice()) {
            suppressSwitch = true
            binding.messageNoticeSwitch.isChecked = settings.messageNotice()
            suppressSwitch = false
        }
        binding.batteryWarning.visibility = if (batteryIgnored()) View.GONE else View.VISIBLE
        val noticeReady = settings.messageNotice() && messageNoticeAllowed() && MessageNoticeReader.connected
        binding.listenHeadline.text = if (noticeReady) "알림 듣는 중" else "듣지 못하는 중"
        binding.listenHeadline.setTextColor(ContextCompat.getColor(this, if (noticeReady) R.color.ink else R.color.danger))
        val journal = NoticeLog(this).recent()
        binding.noticeLog.text = if (journal.isEmpty()) {
            "아직 없습니다."
        } else {
            journal.joinToString("\n") { formatNoticeLine(it, seoul) }
        }
        binding.noticeWarning.visibility = if (noticeReady) View.GONE else View.VISIBLE
        val ago = minutesAgo(settings.lastNoticeAt())
        binding.noticeStatus.text = if (noticeReady) {
            "알림 읽기 연결됨 · 마지막 알림 $ago"
        } else {
            "알림 읽기 연결 안 됨"
        }
        binding.noticeStats.text =
            "메시지 앱 알림 ${settings.noticePosts()}번 · 꺼낸 메시지 ${settings.noticeExtracted()}건 · 농협 입금 ${settings.noticeDeposits()}건 · 새로 보냄 ${settings.noticeSent()}건 · 이미 보낸 것 ${settings.noticeDup()}건"
        binding.noticeExtra.text =
            "요약 알림에서 건진 ${settings.noticeFromSummary()}건 · 다시 훑기로 건진 ${settings.noticeFromRescan()}건 · 서버가 건너뛰거나 거절 ${settings.noticeRejected()}건 · 본문 없음·농협 없음 ${settings.noticeMissed()}건 · 다시 연결 ${settings.noticeRebinds()}회"
        binding.statusListening.text = if (settings.listening()) "상태: 켜짐" else "상태: 꺼짐"
        binding.statusServer.text = when {
            !paired -> "서버: 연결 안 됨"
            settings.needsReconnect() -> "서버: 다시 연결해 주세요"
            else -> "서버: 연결됨 · ${serverLabel()}"
        }
        binding.statusSent.text = "마지막 전송: ${formatEpoch(settings.lastSentAt())}"
        binding.smsPermission.text = "문자 받기 · ${if (smsGranted()) "됨" else "필요"}"
        binding.readSmsPermission.text = "지난 문자 확인 · ${if (readSmsGranted()) "됨" else "필요"}"
        binding.noticePermission.text = "알림 · ${if (noticeGranted()) "됨" else "필요"}"
        binding.batteryPermission.text = "배터리 절약 제외 · ${if (batteryIgnored()) "됨" else "필요"}"
        binding.statusArrivals.text =
            "받은 문자 ${settings.receivedCount()}건 · 그중 입금 ${settings.depositCount()}건 · 오늘 뒤늦게 찾은 ${settings.lateFoundToday()}건"
        binding.statusDrops.text =
            "탈락 · 농협 아님 ${settings.dropCount(DropReason.NoBank)} · 금액 꼴 없음 ${settings.dropCount(DropReason.NoDeposit)} · 출금 ${settings.dropCount(DropReason.Blocked)} · 잔액 못 지움 ${settings.dropCount(DropReason.BalanceLeft)}"
        binding.statusScan.text = if (settings.lastScanAt() <= 0L) {
            "마지막 점검: 없음"
        } else {
            "마지막 점검: ${formatEpoch(settings.lastScanAt())} · 새로 찾은 문자 ${settings.lastScanFound()}건"
        }
        binding.messageNoticePermission.text = "메시지 알림 접근 · ${if (messageNoticeAllowed()) "됨" else "필요"}"
        refreshJob?.cancel()
        refreshJob = ui.launch {
            val rows = withContext(Dispatchers.IO) { DepositDatabase.get(this@MainActivity).sent().recent() }
            val pending = withContext(Dispatchers.IO) { DepositDatabase.get(this@MainActivity).pending().count() }
            binding.statusPending.text = "대기 중: ${pending}건"
            binding.recentList.text = if (rows.isEmpty()) {
                "아직 없습니다."
            } else {
                rows.joinToString("\n") { row ->
                    "${formatIso(row.receivedAt)} · ${row.amountLabel.ifBlank { "금액 없음" }} · ${row.depositorName.ifBlank { "이름 없음" }} · ${row.resultLabel}"
                }
            }
        }
    }

    private fun openNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && !noticeGranted()) {
            askNotice.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        startActivity(
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, packageName),
        )
    }

    private fun openBattery() {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).setData(Uri.parse("package:$packageName"))
        if (intent.resolveActivity(packageManager) != null) startActivity(intent)
        else startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    private fun minutesAgo(at: Long): String {
        if (at <= 0L) return "없음"
        val minutes = ((System.currentTimeMillis() - at) / 60_000L).coerceAtLeast(0L)
        return "${minutes}분 전"
    }

    private fun messageNoticeAllowed(): Boolean = MessageNoticeReader.accessEnabled(this)

    private fun readSmsGranted() = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED

    private fun smsGranted() = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED

    private fun noticeGranted(): Boolean {
        if (Build.VERSION.SDK_INT < 33) return true
        return ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    private fun batteryIgnored(): Boolean {
        val power = getSystemService(PowerManager::class.java)
        return power.isIgnoringBatteryOptimizations(packageName)
    }

    private fun serverLabel(): String {
        return if (settings.serverBase() == DeviceSettings.STAGING) "스테이징" else "운영"
    }

    private fun showPairError(message: String?) {
        binding.pairError.visibility = if (message.isNullOrBlank()) View.GONE else View.VISIBLE
        binding.pairError.text = message.orEmpty()
    }

    private fun formatEpoch(epoch: Long): String {
        if (epoch <= 0L) return "없음"
        val time = Instant.ofEpochMilli(epoch).atZone(seoul)
        return "${time.monthValue}. ${time.dayOfMonth}. ${time.format(DateTimeFormatter.ofPattern("HH:mm"))}"
    }

    private fun formatIso(iso: String): String {
        return try {
            val time = OffsetDateTime.parse(iso).atZoneSameInstant(seoul)
            "${time.monthValue}. ${time.dayOfMonth}. ${time.format(DateTimeFormatter.ofPattern("HH:mm"))}"
        } catch (_: Exception) {
            "시각 없음"
        }
    }

    private fun deviceLabel(): String {
        val maker = Build.MANUFACTURER.orEmpty().trim()
        val model = Build.MODEL.orEmpty().trim()
        val label = listOf(maker, model).filter { it.isNotEmpty() && !it.equals("unknown", true) }.distinct().joinToString(" ")
        return label.ifBlank { "사업자폰" }.take(80)
    }
}
