package bd.paynoc.merchant

import android.app.Application
import androidx.work.BackoffPolicy
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import bd.paynoc.merchant.work.UploadWorker
import java.util.concurrent.TimeUnit

/**
 * Application-level bootstrap. Schedules a periodic drain of the offline
 * SMS queue so pending events reliably reach the backend even when:
 *   - the app was offline when an SMS arrived,
 *   - the process was killed before the SMS-triggered one-time work ran,
 *   - or the device rebooted (WorkManager auto-restores periodic work).
 */
class PayNocApp : Application() {
    override fun onCreate() {
        super.onCreate()
        schedulePeriodicDrain(this)
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
