package com.skcleantec.telecrm.telephony

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.skcleantec.telecrm.api.ApiClient
import com.skcleantec.telecrm.dispatch.TelecrmDispatchExecutor
import org.json.JSONObject

object TelecrmCallHelper {
    fun dial(context: Context, phone: String) {
        val digits = phone.filter { it.isDigit() }
        if (digits.length < 4) {
            Toast.makeText(context, "전화번호(4자 이상)를 입력해 주세요.", Toast.LENGTH_SHORT).show()
            return
        }
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    /** 자동 발신(CALL_PHONE) 또는 다이얼 패드 + 통화 종료 후 앱 복귀 */
    fun placeCall(activity: AppCompatActivity, phone: String) {
        val digits = phone.filter { it.isDigit() }
        if (digits.length < 4) {
            Toast.makeText(activity, "전화번호(4자 이상)를 입력해 주세요.", Toast.LENGTH_SHORT).show()
            return
        }
        CallReturnMonitor.watch(activity)
        val uri = Uri.parse("tel:$digits")
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CALL_PHONE) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            activity.startActivity(Intent(Intent.ACTION_CALL, uri))
            return
        }
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE),
            TelecrmDispatchExecutor.REQUEST_CALL_PHONE,
        )
        activity.startActivity(Intent(Intent.ACTION_DIAL, uri))
    }

    fun onCallPermissionGranted(activity: Activity, pendingPhone: String?) {
        val digits = pendingPhone?.filter { it.isDigit() }.orEmpty()
        if (digits.length < 4) return
        CallReturnMonitor.watch(activity)
        activity.startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:$digits")))
    }

    fun openSms(context: Context, phone: String, body: String = "", imageUrl: String? = null) {
        val digits = phone.filter { it.isDigit() }
        if (digits.isEmpty()) {
            Toast.makeText(context, "전화번호를 입력해 주세요.", Toast.LENGTH_SHORT).show()
            return
        }
        if (imageUrl.isNullOrBlank()) {
            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$digits"))
            if (body.isNotBlank()) intent.putExtra("sms_body", body)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            return
        }
        Thread {
            try {
                val bytes = java.net.URL(imageUrl).openStream().use { it.readBytes() }
                val file = java.io.File(context.cacheDir, "sms_attach_${System.currentTimeMillis()}.jpg")
                file.writeBytes(bytes)
                val uri = androidx.core.content.FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    file,
                )
                android.os.Handler(context.mainLooper).post {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "image/jpeg"
                        putExtra("address", digits)
                        if (body.isNotBlank()) putExtra("sms_body", body)
                        putExtra(Intent.EXTRA_STREAM, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(Intent.createChooser(intent, "문자 보내기"))
                }
            } catch (_: Exception) {
                android.os.Handler(context.mainLooper).post {
                    Toast.makeText(context, "사진 첨부 실패 · 문자만 엽니다", Toast.LENGTH_SHORT).show()
                    openSms(context, digits, body, null)
                }
            }
        }.start()
    }

    fun logCall(
        context: Context,
        apiClient: ApiClient,
        token: String,
        phone: String,
        direction: String,
        inquiryId: String?,
        customerMatch: String?,
        durationSec: Int? = null,
    ) {
        Thread {
            val payload = JSONObject()
                .put("phone", phone.filter { it.isDigit() })
                .put("direction", direction)
                .put("customerMatch", customerMatch?.takeIf { it.isNotBlank() } ?: "unknown")
            if (!inquiryId.isNullOrBlank()) payload.put("inquiryId", inquiryId)
            if (durationSec != null && durationSec > 0) payload.put("durationSec", durationSec)
            apiClient.postCallSession(token, payload).onFailure {
                android.os.Handler(context.mainLooper).post {
                    Toast.makeText(context, "통화 기록 저장 실패", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }

    fun logOutboundCall(
        context: Context,
        apiClient: ApiClient,
        token: String,
        phone: String,
        inquiryId: String?,
        customerMatch: String?,
    ) = logCall(context, apiClient, token, phone, "OUTBOUND", inquiryId, customerMatch)
}
