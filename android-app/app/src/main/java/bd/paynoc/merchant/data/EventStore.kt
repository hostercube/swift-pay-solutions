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

@Entity(tableName = "queued_events")
data class QueuedEvent(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val provider: String,
    val trxId: String,
    val amount: Double,
    val sender: String?,
    @ColumnInfo(name = "raw_body") val rawBody: String,
    @ColumnInfo(name = "received_at_iso") val receivedAtIso: String,
    val status: String = "pending", // pending | sent | failed
    val note: String? = null,
)

@Dao
interface EventDao {
    @Insert
    suspend fun insert(event: QueuedEvent): Long

    @Query("SELECT * FROM queued_events WHERE status = 'pending' ORDER BY id ASC LIMIT :limit")
    suspend fun pending(limit: Int): List<QueuedEvent>

    @Query("UPDATE queued_events SET status = 'sent' WHERE id IN (:ids)")
    suspend fun markSent(ids: List<Long>)

    @Query("UPDATE queued_events SET status = 'failed', note = :note WHERE id IN (:ids)")
    suspend fun markFailed(ids: List<Long>, note: String)

    @Query("SELECT * FROM queued_events ORDER BY id DESC LIMIT 200")
    suspend fun recent(): List<QueuedEvent>
}

@Database(entities = [QueuedEvent::class], version = 1, exportSchema = false)
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
    suspend fun markSent(ids: List<Long>) = db.events().markSent(ids)
    suspend fun markFailed(ids: List<Long>, note: String) = db.events().markFailed(ids, note)

    companion object {
        @Volatile private var instance: EventStore? = null
        fun get(context: Context): EventStore = instance ?: synchronized(this) {
            instance ?: EventStore(
                Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "paynoc-events",
                ).build(),
            ).also { instance = it }
        }

        private val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        fun isoOf(millis: Long): String = iso.format(Date(millis))
    }
}
