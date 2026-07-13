package bd.paynoc.merchant

import android.app.Application
import androidx.work.BackoffPolicy
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import bd.paynoc.merchant.data.Settings
import bd.paynoc.merchant.system.ConnectivityWatcher
import bd.paynoc.merchant.system.ListenerService
import bd.paynoc.merchant.work.UploadWorker
import java.util.concurrent.TimeUnit

/**
 * Application-level bootstrap. Wires up every background component so the
 * app keeps auto-verifying payments even after reboot / app update /
 * network drop / OEM battery kill:
 *
 *   1. WorkManager periodic drain — safety net every 15 min.
 *   2. ConnectivityWatcher — kicks a drain the instant net returns.
 *   3. ListenerService (foreground) — keeps the process warm so the SMS
 *      broadcast receiver isn't silently frozen by aggressive OEMs.
 */
class PayNocApp : Application() {
    override fun onCreate() {
        super.onCreate()
        schedulePeriodicDrain(this)
        ConnectivityWatcher.register(this)
        if (Settings.load(this).isConfigured) {
            ListenerService.start(this)
        }
    }

    companion object {
        const val PERIODIC_NAME = "paynoc-upload-periodic"

        fun schedulePeriodicDrain(app: Application) {
            val request = PeriodicWorkRequestBuilder<UploadWorker>(15, TimeUnit.MINUTES)
                .setConstraints(UploadWorker.constraints())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(app).enqueueUniquePeriodicWork(
                PERIODIC_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }
}
