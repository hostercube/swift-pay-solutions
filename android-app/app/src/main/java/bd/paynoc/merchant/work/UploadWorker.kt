package bd.paynoc.merchant.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import bd.paynoc.merchant.data.EventStore
import bd.paynoc.merchant.data.Settings
import bd.paynoc.merchant.network.PayNocApi

/**
 * Drains queued SMS events to the PayNOC backend. Retried automatically
 * by WorkManager on failure — offline queue drains on next network.
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
            val response = api.postSmsEvents(batch, deviceId)
            if (response.isSuccessful) {
                store.markSent(batch.map { it.id })
                Result.success()
            } else if (response.code() in 500..599) {
                Result.retry()
            } else {
                // 4xx: dead-letter and stop retrying this batch
                store.markFailed(batch.map { it.id }, "HTTP ${response.code()}")
                Result.success()
            }
        } catch (_: Exception) {
            Result.retry()
        }
    }
}
