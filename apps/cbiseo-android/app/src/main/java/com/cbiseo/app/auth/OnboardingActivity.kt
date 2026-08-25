package com.cbiseo.app.auth

import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.viewpager2.widget.ViewPager2
import com.cbiseo.app.R
import com.cbiseo.app.databinding.ActivityOnboardingBinding
import com.cbiseo.app.push.StaffFcmRegistrar
import com.cbiseo.app.push.StaffPushIntentExtras
import com.cbiseo.app.session.StaffRoleResolver
import com.cbiseo.app.web.StaffWebActivity
import kotlin.math.roundToInt

/** 최초 1회 — 슬라이드 소개 후 「시작하기」 */
class OnboardingActivity : AppCompatActivity() {
    private lateinit var binding: ActivityOnboardingBinding
    private val tokenStore by lazy { TokenStore.get(this) }
    private val dotViews = mutableListOf<View>()

    private val slides by lazy {
        listOf(
            OnboardingSlide(
                R.drawable.onboarding_slide_1,
                R.string.onboarding_slide_1_title,
                R.string.onboarding_slide_1_body,
            ),
            OnboardingSlide(
                R.drawable.onboarding_slide_2,
                R.string.onboarding_slide_2_title,
                R.string.onboarding_slide_2_body,
            ),
            OnboardingSlide(
                R.drawable.onboarding_slide_3,
                R.string.onboarding_slide_3_title,
                R.string.onboarding_slide_3_body,
            ),
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOnboardingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val adapter = OnboardingSlideAdapter(slides)
        binding.onboardingPager.adapter = adapter
        setupPageDots(slides.size)
        binding.onboardingPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                updatePageDots(position)
                updatePrimaryAction(position)
            }
        })
        updatePageDots(0)
        updatePrimaryAction(0)

        binding.onboardingPrimaryAction.setOnClickListener {
            val lastIndex = slides.lastIndex
            val current = binding.onboardingPager.currentItem
            if (current < lastIndex) {
                binding.onboardingPager.currentItem = current + 1
            } else {
                finishOnboarding()
            }
        }
    }

    private fun setupPageDots(count: Int) {
        binding.onboardingDots.removeAllViews()
        dotViews.clear()

        val density = resources.displayMetrics.density
        val slotSize = (10f * density).roundToInt()
        val gap = (10f * density).roundToInt()

        repeat(count) { index ->
            val slot = LinearLayout(this).apply {
                layoutParams = LinearLayout.LayoutParams(slotSize, slotSize).apply {
                    if (index > 0) marginStart = gap
                }
                gravity = Gravity.CENTER
            }
            val dot = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    inactiveDotSizePx(),
                    inactiveDotSizePx(),
                )
                setBackgroundResource(R.drawable.onboarding_dot_inactive)
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            slot.addView(dot)
            binding.onboardingDots.addView(slot)
            dotViews.add(dot)
        }
    }

    private fun updatePageDots(position: Int) {
        dotViews.forEachIndexed { index, dot ->
            val active = index == position
            val size = if (active) activeDotSizePx() else inactiveDotSizePx()
            dot.layoutParams.width = size
            dot.layoutParams.height = size
            dot.setBackgroundResource(
                if (active) R.drawable.onboarding_dot_active else R.drawable.onboarding_dot_inactive,
            )
        }
    }

    private fun inactiveDotSizePx(): Int =
        (6f * resources.displayMetrics.density).roundToInt()

    private fun activeDotSizePx(): Int =
        (8f * resources.displayMetrics.density).roundToInt()

    private fun updatePrimaryAction(position: Int) {
        val isLast = position >= slides.lastIndex
        binding.onboardingPrimaryAction.setText(
            if (isLast) R.string.onboarding_start else R.string.onboarding_next,
        )
    }

    private fun finishOnboarding() {
        OnboardingPrefs.setCompleted(this)
        routeAfterOnboarding()
    }

    private fun routeAfterOnboarding() {
        val token = tokenStore.getToken()
        val role = tokenStore.getRole()
        val target = if (!token.isNullOrBlank() && StaffRoleResolver.homePathForRole(role) != null) {
            StaffFcmRegistrar.registerToken(applicationContext)
            StaffWebActivity::class.java
        } else {
            LoginActivity::class.java
        }
        startActivity(Intent(this, target).apply {
            StaffPushIntentExtras.pushPathFrom(intent)?.let { pushPath ->
                putExtra(StaffWebActivity.EXTRA_PUSH_PATH, pushPath)
            }
        })
        finish()
        @Suppress("DEPRECATION")
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
    }
}
