package bd.paynoc.merchant.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import bd.paynoc.merchant.data.EventStore
import bd.paynoc.merchant.parsers.SmsParsers
import bd.paynoc.merchant.work.UploadWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Fires on every incoming SMS. Parses the body, saves anything that looks
 * like a payment SMS to the local Room queue, and schedules an upload.
 */
class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val bySender = messages.groupBy { it.originatingAddress ?: "" }

        val store = EventStore.get(context)
        val scope = CoroutineScope(Dispatchers.IO)

        for ((sender, parts) in bySender) {
            val body = parts.joinToString(separator = "") { it.messageBody ?: "" }
            val parsed = SmsParsers.parse(sender, body) ?: continue
            scope.launch {
                store.enqueue(parsed, receivedAt = System.currentTimeMillis())
                WorkManager.getInstance(context).enqueue(
                    OneTimeWorkRequestBuilder<UploadWorker>().build(),
                )
            }
        }
    }
}
