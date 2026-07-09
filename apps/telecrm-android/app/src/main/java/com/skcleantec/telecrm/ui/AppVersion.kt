package com.skcleantec.telecrm.ui

import android.content.Context
import com.skcleantec.telecrm.BuildConfig
import com.skcleantec.telecrm.R

/** build.gradle versionName / versionCode — 로그인·메인 공통 표시 */
object AppVersion {
    fun displayLabel(context: Context): String =
        context.getString(R.string.app_version_label, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE)
}
