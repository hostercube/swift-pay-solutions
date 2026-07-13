package bd.paynoc.merchant.system

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import bd.paynoc.merchant.PayNocApp
import bd.paynoc.merchant.data.Settings

/**
 * Re-arms background workers after the device reboots or the app is
 * updated. WorkManager persists periodic work, but the foreground
 * listener service and network callback need to be re-registered on the
 * fresh process — otherwise the app is dormant until the user opens it.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED
        ) return

        val app = context.applicationContext as? android.app.Application ?: return
        PayNocApp.schedulePeriodicDrain(app)
        ConnectivityWatcher.register(app)
        if (Settings.load(app).isConfigured) {
            ListenerService.start(app)
        }
    }
}
