package bd.paynoc.merchant.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.UUID

/**
 * Encrypted settings: backend URL + API key + a stable device UUID.
 * Backed by androidx.security so the API key is not stored in plain text.
 *
 * URL and API key format are validated on save — the UI should not be
 * able to persist a cleartext HTTP endpoint or a malformed key.
 */
data class Settings(
    val backendUrl: String?,
    val apiKey: String?,
    val deviceId: String,
) {
    val isConfigured: Boolean get() = !backendUrl.isNullOrBlank() && !apiKey.isNullOrBlank()

    companion object {
        private const val PREFS = "paynoc_secure"
        private const val KEY_BACKEND = "backend_url"
        private const val KEY_API = "api_key"
        private const val KEY_DEVICE = "device_id"

        // sk_live_xxx or sk_test_xxx — 20+ hex chars, matches server validator.
        private val API_KEY_RE = Regex("""^sk_(live|test)_[a-f0-9]{20,}$""", RegexOption.IGNORE_CASE)

        private fun prefs(context: Context) = EncryptedSharedPreferences.create(
            context,
            PREFS,
            MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )

        fun load(context: Context): Settings {
            val p = prefs(context)
            val deviceId = p.getString(KEY_DEVICE, null) ?: run {
                val id = UUID.randomUUID().toString()
                p.edit().putString(KEY_DEVICE, id).apply()
                id
            }
            return Settings(
                backendUrl = p.getString(KEY_BACKEND, null),
                apiKey = p.getString(KEY_API, null),
                deviceId = deviceId,
            )
        }

        sealed class SaveResult {
            data object Ok : SaveResult()
            data class Invalid(val message: String) : SaveResult()
        }

        fun save(context: Context, backendUrl: String, apiKey: String): SaveResult {
            val url = backendUrl.trim().trimEnd('/')
            val key = apiKey.trim()
            if (!url.startsWith("https://", ignoreCase = true)) {
                return SaveResult.Invalid("Backend URL must start with https:// — the API key must never travel over HTTP.")
            }
            if (!API_KEY_RE.matches(key)) {
                return SaveResult.Invalid("API key must look like sk_live_… or sk_test_… (get one from Security → API keys).")
            }
            prefs(context).edit()
                .putString(KEY_BACKEND, url)
                .putString(KEY_API, key)
                .apply()
            return SaveResult.Ok
        }

        fun clear(context: Context) {
            prefs(context).edit()
                .remove(KEY_BACKEND)
                .remove(KEY_API)
                .apply()
        }
    }
}
