package bd.paynoc.merchant.network

import bd.paynoc.merchant.data.QueuedEvent
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.security.SecureRandom
import java.util.concurrent.TimeUnit
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Thin HTTP client for the PayNOC public API. Uses the merchant's API key
 * as a Bearer token — the same one accepted by /api/public/v1/invoices.
 *
 * The client only talks HTTPS: [PayNocApi.create] refuses to build against
 * an http:// URL so a misconfigured backend can never leak the key.
 */
class PayNocApi private constructor(
    private val baseUrl: String,
    private val apiKey: String,
) {
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val moshi: Moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val requestAdapter = moshi.adapter(SmsEventsBody::class.java)
    private val responseAdapter = moshi.adapter(SmsEventsResponse::class.java)

    @JsonClass(generateAdapter = true)
    data class SmsEventDto(
        val provider: String,
        val raw_body: String,
        val trx_id: String,
        val amount: Double,
        val sender: String?,
        val received_at: String,
        val device_id: String,
    )

    @JsonClass(generateAdapter = true)
    data class SmsEventsBody(val events: List<SmsEventDto>)

    /** Server-side per-event outcome — order matches request `events`. */
    @JsonClass(generateAdapter = true)
    data class SmsEventResult(
        val trx_id: String?,
        val matched: Boolean = false,
        val invoice_id: String? = null,
        val reason: String? = null,
    )

    @JsonClass(generateAdapter = true)
    data class SmsEventsResponse(
        val ok: Boolean = false,
        val results: List<SmsEventResult> = emptyList(),
    )

    /** HTTP result + parsed per-event outcomes (empty on non-2xx). */
    data class PostResult(
        val httpCode: Int,
        val isSuccessful: Boolean,
        val results: List<SmsEventResult>,
    )

    fun postSmsEvents(batch: List<QueuedEvent>, deviceId: String): PostResult {
        val body = SmsEventsBody(
            events = batch.map {
                SmsEventDto(
                    provider = it.provider,
                    raw_body = it.rawBody,
                    trx_id = it.trxId,
                    amount = it.amount,
                    sender = it.sender,
                    received_at = it.receivedAtIso,
                    device_id = deviceId,
                )
            },
        )
        val json = requestAdapter.toJson(body)
        val ts = (System.currentTimeMillis() / 1000L).toString()
        val nonce = randomNonce()
        // HMAC(SHA256, apiKey) over "<ts>.<nonce>.<body>" — lets the backend
        // reject replayed or tampered payloads even if the key ever leaks
        // from a device backup. Backend that doesn't verify this header
        // simply ignores it, so it's safe to always send.
        val signature = hmacSha256Hex(apiKey, "$ts.$nonce.$json")
        val request = Request.Builder()
            .url("$baseUrl/api/public/v1/sms-events")
            .header("Authorization", "Bearer $apiKey")
            .header("Content-Type", "application/json")
            .header("User-Agent", "PayNOC-Merchant-APK/1.2")
            .header("X-PayNOC-Timestamp", ts)
            .header("X-PayNOC-Nonce", nonce)
            .header("X-PayNOC-Signature", "sha256=$signature")
            .header("X-PayNOC-Device", deviceId)
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(request).execute().use { response ->
            val code = response.code()
            val parsed = if (response.isSuccessful) {
                runCatching {
                    val text = response.body?.string().orEmpty()
                    responseAdapter.fromJson(text)?.results.orEmpty()
                }.getOrDefault(emptyList())
            } else emptyList()
            return PostResult(
                httpCode = code,
                isSuccessful = response.isSuccessful,
                results = parsed,
            )
        }
    }

    /** Cheap round-trip that authenticates the key. Returns the HTTP status. */
    fun ping(): Int {
        val request = Request.Builder()
            .url("$baseUrl/api/public/v1/balance")
            .header("Authorization", "Bearer $apiKey")
            .header("User-Agent", "PayNOC-Merchant-APK/1.2")
            .get()
            .build()
        return http.newCall(request).execute().use { it.code() }
    }

    private fun randomNonce(): String {
        val bytes = ByteArray(12)
        SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun hmacSha256Hex(key: String, data: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return mac.doFinal(data.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    companion object {
        /** Builds a client for the given base URL — refuses non-HTTPS. */
        fun create(baseUrl: String, apiKey: String): PayNocApi {
            val url = baseUrl.trim().trimEnd('/')
            require(url.startsWith("https://", ignoreCase = true)) {
                "Backend URL must be https:// — refusing to send API key over cleartext"
            }
            return PayNocApi(url, apiKey)
        }

        // Legacy constructor kept for source-compatible callers.
        operator fun invoke(baseUrl: String, apiKey: String): PayNocApi = create(baseUrl, apiKey)
    }
}
