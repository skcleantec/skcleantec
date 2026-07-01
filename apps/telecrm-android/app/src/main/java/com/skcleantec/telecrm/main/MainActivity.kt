package com.skcleantec.telecrm.main

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.snackbar.Snackbar
import com.skcleantec.telecrm.R
import com.skcleantec.telecrm.auth.LoginActivity
import com.skcleantec.telecrm.auth.TokenStore
import com.skcleantec.telecrm.databinding.ActivityMainBinding
import com.skcleantec.telecrm.realtime.AppEventBus
import com.skcleantec.telecrm.realtime.InboxWebSocketClient

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private val tokenStore by lazy { TokenStore(this) }
    private val webSocketClient = InboxWebSocketClient()

    private val connectionListener: (Boolean) -> Unit = { connected ->
        binding.wsStatusChip.text = getString(
            if (connected) R.string.ws_connected else R.string.ws_disconnected,
        )
        binding.wsStatusChip.setBackgroundResource(
            if (connected) R.drawable.bg_header_emerald else R.drawable.bg_header_rose,
        )
    }

    private val toastListener: (AppEventBus.ToastAlert) -> Unit = { alert ->
        Snackbar.make(binding.root, "${alert.title}: ${alert.body}", Snackbar.LENGTH_LONG).show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val token = tokenStore.getToken()
        if (token.isNullOrBlank()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        binding.toolbar.inflateMenu(R.menu.main_menu)
        binding.toolbar.setOnMenuItemClickListener { item ->
            if (item.itemId == R.id.action_logout) {
                logout()
                true
            } else false
        }

        binding.viewPager.adapter = MainPagerAdapter(this)
        binding.viewPager.isUserInputEnabled = false
        binding.viewPager.offscreenPageLimit = 4

        binding.bottomNav.setOnItemSelectedListener { item ->
            binding.viewPager.currentItem = when (item.itemId) {
                R.id.nav_dial -> 0
                R.id.nav_incoming -> 1
                R.id.nav_work -> 2
                R.id.nav_messages -> 3
                else -> 0
            }
            true
        }

        webSocketClient.connect(token)
        AppEventBus.addConnectionListener(connectionListener)
        AppEventBus.addToastListener(toastListener)
    }

    override fun onDestroy() {
        AppEventBus.removeConnectionListener(connectionListener)
        AppEventBus.removeToastListener(toastListener)
        webSocketClient.disconnect()
        super.onDestroy()
    }

    private fun logout() {
        webSocketClient.disconnect()
        tokenStore.clearSession()
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }
}
