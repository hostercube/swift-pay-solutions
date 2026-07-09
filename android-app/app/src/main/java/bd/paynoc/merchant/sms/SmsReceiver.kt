package bd.paynoc.merchant.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.BackoffPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import bd.paynoc.merchant.data.EventStore
import bd.paynoc.merchant.parsers.SmsParsers
import bd.paynoc.merchant.work.UploadWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

/**
 * Fires on every incoming SMS. Parses the body, saves anything that looks
 * like a payment SMS to the local Room queue, and schedules an upload.
 *
 * Uses `goAsync()` so the process is kept alive while Room writes finish —
 * a plain launch() on a BroadcastReceiver races the OS kill and loses data.
 */
class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val bySender = messages.groupBy { it.originatingAddress ?: "" }

        val pending = goAsync()
        val store = EventStore.get(context.applicationContext)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        scope.launch {
            try {
                var enqueued = 0
                for ((sender, parts) in bySender) {
                    val body = parts.joinToString(separator = "") { it.messageBody ?: "" }
                    val parsed = SmsParsers.parse(sender, body) ?: continue
                    store.enqueue(parsed, receivedAt = System.currentTimeMillis())
                    enqueued++
                }
                if (enqueued > 0) {
                    // Coalesce bursts of SMS into a single upload attempt.
                    WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                        UploadWorker.UNIQUE_NAME,
                        ExistingWorkPolicy.APPEND_OR_REPLACE,
                        OneTimeWorkRequestBuilder<UploadWorker>()
                            .setConstraints(UploadWorker.constraints())
                            .build(),
                    )
                }
            } finally {
                pending.finish()
            }
        }
    }
}
