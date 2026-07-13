package bd.paynoc.merchant.data

import android.content.Context
import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import bd.paynoc.merchant.parsers.ParsedSms
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Local SMS queue.
 *
 * `status` values:
 *  - `pending`    — captured, not yet uploaded
 *  - `matched`    — uploaded AND the backend matched it to a pending invoice
 *                   (invoice was auto-verified, webhook fired, merchant paid).
 *  - `unmatched`  — uploaded but the backend had no pending transaction for
 *                   this trxId / amount / sender (informational only — the
 *                   SMS is not necessarily a real payment for this merchant).
 *  - `failed`     — permanent HTTP 4xx from the API (bad key, malformed).
 *                   Tap "Retry failed" in the UI to re-queue as `pending`.
 */
@Entity(tableName = "queued_events")
data class QueuedEvent(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val provider: String,
    val trxId: String,
    val amount: Double,
    val sender: String?,
    @ColumnInfo(name = "raw_body") val rawBody: String,
    @ColumnInfo(name = "received_at_iso") val receivedAtIso: String,
    val status: String = "pending",
    val note: String? = null,
    @ColumnInfo(name = "invoice_id") val invoiceId: String? = null,
)

@Dao
interface EventDao {
    @Insert
    suspend fun insert(event: QueuedEvent): Long

    @Query("SELECT * FROM queued_events WHERE status = 'pending' ORDER BY id ASC LIMIT :limit")
    suspend fun pending(limit: Int): List<QueuedEvent>

    @Query("UPDATE queued_events SET status = :status, note = :note, invoice_id = :invoiceId WHERE id = :id")
    suspend fun updateResult(id: Long, status: String, note: String?, invoiceId: String?)

    @Query("UPDATE queued_events SET status = 'failed', note = :note WHERE id IN (:ids)")
    suspend fun markFailedBatch(ids: List<Long>, note: String)

    @Query("UPDATE queued_events SET status = 'pending', note = NULL WHERE status = 'failed'")
    suspend fun requeueFailed(): Int

    @Query("SELECT * FROM queued_events ORDER BY id DESC LIMIT 200")
    suspend fun recent(): List<QueuedEvent>

    @Query("SELECT COUNT(*) FROM queued_events WHERE status = 'failed'")
    suspend fun failedCount(): Int
}

@Database(entities = [QueuedEvent::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun events(): EventDao
}

/**
 * Facade over Room + a tiny date helper. Everything the rest of the app
 * needs to touch the SMS queue goes through here.
 */
class EventStore private constructor(private val db: AppDatabase) {

    suspend fun enqueue(parsed: ParsedSms, receivedAt: Long) {
        db.events().insert(
            QueuedEvent(
                provider = parsed.provider,
                trxId = parsed.trxId,
                amount = parsed.amount,
                sender = parsed.sender,
                rawBody = parsed.rawBody,
                receivedAtIso = isoOf(receivedAt),
            ),
        )
    }

    suspend fun pending(limit: Int): List<QueuedEvent> = db.events().pending(limit)
    suspend fun recent(): List<QueuedEvent> = db.events().recent()
    suspend fun updateResult(id: Long, status: String, note: String?, invoiceId: String?) =
        db.events().updateResult(id, status, note, invoiceId)
    suspend fun markFailedBatch(ids: List<Long>, note: String) =
        db.events().markFailedBatch(ids, note)
    suspend fun requeueFailed(): Int = db.events().requeueFailed()
    suspend fun failedCount(): Int = db.events().failedCount()

    companion object {
        @Volatile private var instance: EventStore? = null
        fun get(context: Context): EventStore = instance ?: synchronized(this) {
            instance ?: EventStore(
                Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "paynoc-events",
                )
                    // Queue is device-local + self-healing — drop old rows on
                    // schema upgrade rather than shipping migrations.
                    .fallbackToDestructiveMigration()
                    .build(),
            ).also { instance = it }
        }

        // SimpleDateFormat is NOT thread-safe. SMS bursts arrive on the IO
        // dispatcher and can call isoOf() concurrently — a shared instance
        // would corrupt its internal Calendar and emit garbage timestamps.
        // ThreadLocal gives each thread its own formatter.
        private val iso = ThreadLocal.withInitial {
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
        }

        fun isoOf(millis: Long): String = iso.get()!!.format(Date(millis))
    }
}
