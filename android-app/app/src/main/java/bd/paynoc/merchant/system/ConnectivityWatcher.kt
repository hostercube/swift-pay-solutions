package bd.paynoc.merchant.system

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.work.BackoffPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import bd.paynoc.merchant.work.UploadWorker
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Kicks a drain the moment the device regains internet. This makes the
 * offline→online round-trip near-instant instead of waiting up to 15 min
 * for the periodic worker to fire.
 */
object ConnectivityWatcher {
    private val registered = AtomicBoolean(false)

    fun register(app: Application) {
        if (!registered.compareAndSet(false, true)) return
        val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            .build()
        cm.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                WorkManager.getInstance(app).enqueueUniqueWork(
                    UploadWorker.UNIQUE_NAME,
                    ExistingWorkPolicy.APPEND_OR_REPLACE,
                    OneTimeWorkRequestBuilder<UploadWorker>()
                        .setConstraints(UploadWorker.constraints())
                        .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                        .build(),
                )
            }
        })
    }
}
