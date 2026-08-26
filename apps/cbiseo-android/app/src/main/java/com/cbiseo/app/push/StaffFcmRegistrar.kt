package com.cbiseo.app.push



import android.Manifest

import android.app.NotificationChannel

import android.app.NotificationManager

import android.content.pm.PackageManager

import android.os.Build

import androidx.activity.ComponentActivity

import androidx.activity.result.ActivityResultLauncher

import androidx.core.content.ContextCompat

import com.cbiseo.app.auth.TokenStore

import com.google.firebase.messaging.FirebaseMessaging

import kotlinx.coroutines.CoroutineScope

import kotlinx.coroutines.Dispatchers

import kotlinx.coroutines.launch



object StaffFcmRegistrar {

    const val CHANNEL_DEFAULT = "cbiseo_staff_default"



    fun ensureChannels(context: android.content.Context) {

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = context.getSystemService(NotificationManager::class.java) ?: return

        if (manager.getNotificationChannel(CHANNEL_DEFAULT) != null) return

        manager.createNotificationChannel(

            NotificationChannel(

                CHANNEL_DEFAULT,

                "청소비서 알림",

                NotificationManager.IMPORTANCE_HIGH,

            ).apply {

                description = "배정·메시지·업무 알림"

                enableVibration(true)

            },

        )

    }



    fun requestPermissionIfNeeded(

        activity: ComponentActivity,

        permissionLauncher: ActivityResultLauncher<String>,

        onFinished: () -> Unit = {},

    ) {

        ensureChannels(activity.applicationContext)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {

            val granted = ContextCompat.checkSelfPermission(

                activity,

                Manifest.permission.POST_NOTIFICATIONS,

            ) == PackageManager.PERMISSION_GRANTED

            if (!granted) {

                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)

                return

            }

        }

        onFinished()

    }



    fun registerTokenForce(

        context: android.content.Context,

        jwtOverride: String? = null,

        onResult: ((Boolean, String) -> Unit)? = null,

    ) {

        StaffPushRegistration.registerNow(

            context = context,

            source = "force",

            jwtOverride = jwtOverride,

            knownFcmToken = null,

            onFinished = onResult,

        )

    }



    fun registerToken(

        context: android.content.Context,

        knownFcmToken: String? = null,

        jwtOverride: String? = null,

        onResult: ((Boolean, String) -> Unit)? = null,

    ) {

        StaffPushRegistration.registerNow(

            context = context,

            source = "register",

            jwtOverride = jwtOverride,

            knownFcmToken = knownFcmToken,

            onFinished = onResult,

        )

    }



    fun unregisterToken(context: android.content.Context, jwtOverride: String? = null) {

        val jwt = jwtOverride?.trim()?.takeIf { it.isNotBlank() }

            ?: TokenStore.get(context).getToken()?.trim().orEmpty()

        if (jwt.isBlank()) return

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->

            val token = task.result?.trim()?.takeIf { it.length >= 20 }

            CoroutineScope(Dispatchers.Main).launch {

                StaffPushApi.unregisterToken(context, token, jwtOverride = jwt)

                StaffPushTokenCache.clear(context)

            }

        }

    }



    /** 다른 아이디로 로그인하기 전 — 이전 계정 FCM 등록 해제(동일 기기 토큰 잔류 방지) */

    fun unregisterBeforeAccountSwitch(

        context: android.content.Context,

        oldJwt: String,

        onComplete: () -> Unit,

    ) {

        val jwt = oldJwt.trim()

        if (jwt.isBlank()) {

            onComplete()

            return

        }

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->

            val token = task.result?.trim()?.takeIf { it.length >= 20 }

            CoroutineScope(Dispatchers.Main).launch {

                StaffPushApi.unregisterToken(context, token, jwtOverride = jwt)

                onComplete()

            }

        }

    }

}

