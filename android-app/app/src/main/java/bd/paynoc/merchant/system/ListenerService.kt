package bd.paynoc.merchant.system

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import bd.paynoc.merchant.ui.MainActivity

/**
 * Persistent foreground service that keeps the process warm so aggressive
 * OEM battery savers don't kill the SMS receiver. The service itself does
 * no work — it exists purely to raise our process importance and pin an
 * always-visible "listening" notification the user can trust.
 */
class ListenerService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel(this)
        val tapIntent = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pi = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("PayNOC is listening")
            .setContentText("Auto-verifying incoming payment SMS")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(pi)
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                NOTIF_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }
        return START_STICKY
    }

    /**
     * API 34 caps a `dataSync`-typed foreground service at ~6 cumulative
     * hours per rolling 24 h — after which the OS invokes `onTimeout()` and
     * force-stops us. Stop cleanly; the periodic `UploadWorker` (15 min) +
     * `ConnectivityWatcher` cover the gap, and `SmsReceiver` still fires on
     * every incoming SMS even without the FGS.
     */
    override fun onTimeout(startId: Int) {
        runCatching { stopSelf(startId) }
    }

    companion object {
        const val CHANNEL_ID = "paynoc_listener"
        const val NOTIF_ID = 4711

        fun start(context: Context) {
            val intent = Intent(context, ListenerService::class.java)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, ListenerService::class.java))
        }

        private fun ensureChannel(ctx: Context) {
            if (Build.VERSION.SDK_INT < 26) return
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Background listener",
                    NotificationManager.IMPORTANCE_LOW,
                ).apply {
                    description = "Keeps PayNOC alive so payment SMS is captured instantly."
                    setShowBadge(false)
                },
            )
        }
    }
}
