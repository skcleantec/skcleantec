package com.skcleantec.telecrm.main

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter

class MainPagerAdapter(activity: FragmentActivity) : FragmentStateAdapter(activity) {
    override fun getItemCount(): Int = 4

    override fun createFragment(position: Int): Fragment = when (position) {
        0 -> DialFragment()
        1 -> IncomingFragment()
        2 -> WorkFragment()
        3 -> MessagesFragment()
        else -> DialFragment()
    }
}
