package com.skcleantec.telecrm.telephony

import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log

/**
 * 수신 벨 시 발신번호 수신 (잠금 화면·Android 10+ 에서 PHONE_STATE 보다 안정적).
 * 설정 → 앱 → 기본 앱 → 「발신번호 표시 및 스팸 앱」에서 청소비서(마케터) 허용 필요.
 */
class TelecrmCallScreeningService : CallScreeningService() {
    override fun onScreenCall(callDetails: Call.Details) {
        val digits = callDetails.handle?.schemeSpecificPart?.filter { it.isDigit() }.orEmpty()
        if (digits.length >= 4) {
            IncomingCallRouter.onRinging(applicationContext, digits)
        } else {
            Log.w(TAG, "onScreenCall without number handle=${callDetails.handle}")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            respondToCall(
                callDetails,
                CallResponse.Builder()
                    .setDisallowCall(false)
                    .setRejectCall(false)
                    .setSilenceCall(false)
                    .setSkipCallLog(false)
                    .build(),
            )
        }
    }

    companion object {
        private const val TAG = "TelecrmCallScreening"
    }
}
