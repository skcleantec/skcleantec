package com.skcleantec.telecrm.telephony

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.ui.TelecrmLookupDetailRenderer
import org.json.JSONObject
import kotlin.math.abs

/**
 * 기본 전화 화면 위에 겹쳐 뜨는 고객 정보 카드 (후후·T전화 방식).
 * 「다른 앱 위에 표시」 권한이 있어야 보임. 벨이 울릴 때 크게, 받은 뒤엔 위쪽에 한 줄로 작게.
 */
object CallerOverlay {
    private val main = Handler(Looper.getMainLooper())
    private var root: LinearLayout? = null
    private var nameView: TextView? = null
    private var detailView: TextView? = null
    private var params: WindowManager.LayoutParams? = null
    private var compact = false
    private var userMoved = false

    private const val PREFS = "telecrm_caller_overlay"
    private const val KEY_Y_RATIO = "ringing_y_ratio"

    fun canShow(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

    /** 벨 울리는 중 — 큰 카드 */
    fun showRinging(context: Context, phone: String, lookup: JSONObject?, error: String?) {
        val app = context.applicationContext
        main.post {
            if (!canShow(app)) return@post
            ensureView(app)
            compact = false
            render(app, phone, lookup, error)
            place(app)
        }
    }

    /** 통화 중 — 위쪽 한 줄 (통화 버튼을 가리지 않게) */
    fun showInCall(context: Context, phone: String, lookup: JSONObject?) {
        val app = context.applicationContext
        main.post {
            if (!canShow(app)) return@post
            if (lookup == null && root == null) return@post
            ensureView(app)
            compact = true
            render(app, phone, lookup, null)
            place(app)
        }
    }

    fun hide(context: Context) {
        val app = context.applicationContext
        main.post {
            val v = root ?: return@post
            runCatching { windowManager(app).removeView(v) }
            root = null
            nameView = null
            detailView = null
            params = null
            userMoved = false
        }
    }

    private fun windowManager(context: Context): WindowManager =
        context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    private fun dp(context: Context, v: Int): Int = (v * context.resources.displayMetrics.density).toInt()

    @SuppressLint("ClickableViewAccessibility")
    private fun ensureView(context: Context) {
        if (root != null) return
        val card = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(context, 16), dp(context, 12), dp(context, 12), dp(context, 14))
            background = GradientDrawable().apply {
                cornerRadius = dp(context, 16).toFloat()
                setColor(ContextCompat.getColor(context, R.color.slate_900))
            }
            elevation = dp(context, 8).toFloat()
        }
        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val label = TextView(context).apply {
            text = context.getString(R.string.caller_overlay_label)
            setTextColor(ContextCompat.getColor(context, R.color.slate_300))
            textSize = 12f
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val close = TextView(context).apply {
            text = "✕"
            setTextColor(ContextCompat.getColor(context, R.color.slate_300))
            textSize = 16f
            gravity = Gravity.CENTER
            minWidth = dp(context, 36)
            minHeight = dp(context, 28)
            contentDescription = context.getString(R.string.caller_overlay_close)
            setOnClickListener { hide(context) }
        }
        header.addView(label)
        header.addView(close)
        val name = TextView(context).apply {
            setTextColor(ContextCompat.getColor(context, R.color.white))
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
        }
        val detail = TextView(context).apply {
            setTextColor(ContextCompat.getColor(context, R.color.slate_300))
            textSize = 13f
            maxLines = 4
            ellipsize = TextUtils.TruncateAt.END
            setPadding(0, dp(context, 4), 0, 0)
        }
        card.addView(header)
        card.addView(name)
        card.addView(detail)

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
        @Suppress("DEPRECATION")
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            horizontalMargin = 0f
        }
        // 손가락으로 위아래로 옮길 수 있게 (벨 울릴 때 위치는 기억)
        var downRawY = 0f
        var startY = 0
        card.setOnTouchListener { _, ev ->
            val p = params ?: return@setOnTouchListener false
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downRawY = ev.rawY
                    startY = p.y
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dy = (ev.rawY - downRawY).toInt()
                    if (abs(dy) < dp(context, 6)) return@setOnTouchListener false
                    p.y = (startY + dy).coerceAtLeast(0)
                    userMoved = true
                    runCatching { windowManager(context).updateViewLayout(root, p) }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (userMoved && !compact) {
                        val h = context.resources.displayMetrics.heightPixels.toFloat()
                        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                            .edit().putFloat(KEY_Y_RATIO, p.y / h).apply()
                    }
                    false
                }
                else -> false
            }
        }
        val wrapper = LinearLayout(context).apply {
            setPadding(dp(context, 12), 0, dp(context, 12), 0)
            addView(card, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }
        val added = runCatching { windowManager(context).addView(wrapper, lp) }.isSuccess
        if (!added) return
        root = wrapper
        nameView = name
        detailView = detail
        params = lp
    }

    private fun render(context: Context, phone: String, lookup: JSONObject?, error: String?) {
        val name = nameView ?: return
        val detail = detailView ?: return
        val phoneText = formatPhone(phone)
        when {
            lookup != null -> {
                name.text = CallerInfo.title(lookup) ?: context.getString(R.string.incoming_call_first_caller)
                val inq = CallerInfo.latestInquiry(lookup)
                val lines = if (inq != null) TelecrmLookupDetailRenderer.summaryLines(inq, lookup) else emptyList()
                detail.text = (listOf(phoneText) + lines).joinToString("\n")
            }
            error != null -> {
                name.text = context.getString(R.string.incoming_call_lookup_failed)
                detail.text = "$phoneText\n$error"
            }
            else -> {
                name.text = context.getString(R.string.incoming_call_lookup_loading)
                detail.text = phoneText
            }
        }
        name.textSize = if (compact) 16f else 20f
        detail.maxLines = if (compact) 1 else 4
    }

    private fun place(context: Context) {
        val p = params ?: return
        val v = root ?: return
        val h = context.resources.displayMetrics.heightPixels
        if (!userMoved || compact) {
            p.y = if (compact) {
                dp(context, 32)
            } else {
                val ratio = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getFloat(KEY_Y_RATIO, 0.36f)
                (h * ratio).toInt()
            }
        }
        runCatching { windowManager(context).updateViewLayout(v, p) }
    }

    private fun formatPhone(digits: String): String {
        if (digits.length == 11 && digits.startsWith("010")) {
            return "${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7)}"
        }
        return digits
    }
}
