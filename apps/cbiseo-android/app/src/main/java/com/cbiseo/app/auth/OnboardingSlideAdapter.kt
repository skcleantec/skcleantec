package com.cbiseo.app.auth

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.recyclerview.widget.RecyclerView
import com.cbiseo.app.databinding.ItemOnboardingSlideBinding

data class OnboardingSlide(
    @DrawableRes val imageRes: Int,
    @StringRes val titleRes: Int,
    @StringRes val bodyRes: Int,
)

class OnboardingSlideAdapter(
    private val slides: List<OnboardingSlide>,
) : RecyclerView.Adapter<OnboardingSlideAdapter.SlideViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SlideViewHolder {
        val binding = ItemOnboardingSlideBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false,
        )
        return SlideViewHolder(binding)
    }

    override fun onBindViewHolder(holder: SlideViewHolder, position: Int) {
        holder.bind(slides[position])
    }

    override fun getItemCount(): Int = slides.size

    class SlideViewHolder(
        private val binding: ItemOnboardingSlideBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(slide: OnboardingSlide) {
            binding.slideImage.setImageResource(slide.imageRes)
            val title = binding.root.context.getString(slide.titleRes).trim()
            val body = binding.root.context.getString(slide.bodyRes).trim()
            binding.slideTitle.text = title
            binding.slideTitle.visibility =
                if (title.isEmpty()) android.view.View.GONE else android.view.View.VISIBLE
            binding.slideBody.text = body
            binding.slideBody.visibility =
                if (body.isEmpty()) android.view.View.GONE else android.view.View.VISIBLE
        }
    }
}
