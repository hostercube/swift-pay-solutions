package bd.paynoc.merchant.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.WorkerParameters
import bd.paynoc.merchant.data.EventStore
import bd.paynoc.merchant.data.Settings
import bd.paynoc.merchant.network.PayNocApi
import java.util.concurrent.TimeUnit

/**
 * Drains queued SMS events to the PayNOC backend. Retried automatically
 * by WorkManager on transient failure — the offline queue drains as soon
 * as the network is available.
 *
 * Guarantees:
 *  - Response body is always closed (`response.use { ... }`) — no OkHttp leak.
 *  - 2xx → mark sent.
 *  - 5xx / network error → retry with exponential backoff (up to 24h).
 *  - 4xx → dead-letter the batch so we stop retrying a permanently bad payload.
 */
class UploadWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val settings = Settings.load(applicationContext)
        val baseUrl = settings.backendUrl ?: return Result.success()
        val apiKey = settings.apiKey ?: return Result.success()
        val deviceId = settings.deviceId

        val store = EventStore.get(applicationContext)
        val batch = store.pending(limit = 25)
        if (batch.isEmpty()) return Result.success()

        val api = PayNocApi(baseUrl, apiKey)
        return try {
            api.postSmsEvents(batch, deviceId).use { response ->
                when {
                    response.isSuccessful -> {
                        store.markSent(batch.map { it.id })
                        Result.success()
                    }
                    response.code() in 500..599 -> Result.retry()
                    response.code() == 429 -> Result.retry()
                    else -> {
                        // 4xx (auth, validation) — stop retrying this batch
                        val note = "HTTP ${response.code()}"
                        store.markFailed(batch.map { it.id }, note)
                        Result.success()
                    }
                }
            }
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val UNIQUE_NAME = "paynoc-upload"

        fun constraints(): Constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val BACKOFF_SECONDS: Long = TimeUnit.SECONDS.toSeconds(30)
        val BACKOFF_POLICY = BackoffPolicy.EXPONENTIAL
    }
}
