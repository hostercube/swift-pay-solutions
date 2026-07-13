package bd.paynoc.merchant.work

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.WorkerParameters
import bd.paynoc.merchant.data.EventStore
import bd.paynoc.merchant.data.QueuedEvent
import bd.paynoc.merchant.data.Settings
import bd.paynoc.merchant.network.PayNocApi
import java.util.concurrent.TimeUnit
import kotlin.math.roundToLong

/**
 * Drains queued SMS events to the PayNOC backend. Retried automatically
 * by WorkManager on transient failure — the offline queue drains as soon
 * as the network is available.
 *
 * Per-event outcome (as reported by the backend response) is written back
 * to each row so the merchant sees WHICH SMS auto-verified an invoice vs
 * which was uploaded but had no matching pending transaction. A heads-up
 * notification fires for each match.
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

        val api = PayNocApi.create(baseUrl, apiKey)
        return try {
            val res = api.postSmsEvents(batch, deviceId)
            when {
                res.isSuccessful -> {
                    applyResults(store, batch, res.results)
                    Result.success()
                }
                res.httpCode in 500..599 || res.httpCode == 429 -> Result.retry()
                else -> {
                    store.markFailedBatch(batch.map { it.id }, "HTTP ${res.httpCode}")
                    Result.success()
                }
            }
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private suspend fun applyResults(
        store: EventStore,
        batch: List<QueuedEvent>,
        results: List<PayNocApi.SmsEventResult>,
    ) {
        // Best-effort pairing:
        //  1) match by trx_id (the server echoes what we sent),
        //  2) fall back to index when trx_ids collide inside the same batch.
        val remaining = results.toMutableList()
        for ((idx, ev) in batch.withIndex()) {
            val idxOfTrx = remaining.indexOfFirst {
                !it.trx_id.isNullOrBlank() && it.trx_id.equals(ev.trxId, ignoreCase = true)
            }
            val hit = when {
                idxOfTrx >= 0 -> remaining.removeAt(idxOfTrx)
                idx < remaining.size -> remaining.removeAt(0)
                else -> null
            }
            if (hit == null) {
                // Server didn't include a result — treat as uploaded, no info.
                store.updateResult(ev.id, "unmatched", "Uploaded (no server result)", null)
                continue
            }
            if (hit.matched) {
                store.updateResult(ev.id, "matched", "Auto-verified", hit.invoice_id)
                notifyMatched(ev, hit.invoice_id)
            } else {
                store.updateResult(ev.id, "unmatched", hit.reason ?: "No matching invoice", null)
            }
        }
    }

    private fun notifyMatched(ev: QueuedEvent, invoiceId: String?) {
        ensureChannel(applicationContext)
        val nm = NotificationManagerCompat.from(applicationContext)
        val postGranted = if (Build.VERSION.SDK_INT >= 33) {
            ContextCompat.checkSelfPermission(
                applicationContext,
                android.Manifest.permission.POST_NOTIFICATIONS,
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        } else true
        if (!postGranted) return
        val amt = if (ev.amount % 1.0 == 0.0) ev.amount.roundToLong().toString()
        else "%.2f".format(ev.amount)
        val body = buildString {
            append("TrxID ${ev.trxId}")
            if (!invoiceId.isNullOrBlank()) append(" · Invoice ${invoiceId.take(8)}")
        }
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("৳ $amt auto-verified · ${ev.provider.uppercase()}")
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .build()
        runCatching { nm.notify(ev.id.toInt(), notification) }
    }

    companion object {
        const val UNIQUE_NAME = "paynoc-upload"
        private const val CHANNEL_ID = "paynoc_matches"

        fun constraints(): Constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val BACKOFF_SECONDS: Long = TimeUnit.SECONDS.toSeconds(30)
        val BACKOFF_POLICY = BackoffPolicy.EXPONENTIAL

        private fun ensureChannel(ctx: Context) {
            if (Build.VERSION.SDK_INT < 26) return
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Payment auto-verifications",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Fires when a payment SMS is matched to an invoice."
                },
            )
        }
    }
}
