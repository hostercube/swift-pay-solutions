package bd.paynoc.merchant.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.UUID

/**
 * Encrypted settings: backend URL + API key + a stable device UUID.
 * Backed by androidx.security so the API key is not stored in plain text.
 */
data class Settings(
    val backendUrl: String?,
    val apiKey: String?,
    val deviceId: String,
) {
    companion object {
        private const val PREFS = "paynoc_secure"
        private const val KEY_BACKEND = "backend_url"
        private const val KEY_API = "api_key"
        private const val KEY_DEVICE = "device_id"

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

        fun save(context: Context, backendUrl: String, apiKey: String) {
            prefs(context).edit()
                .putString(KEY_BACKEND, backendUrl.trim())
                .putString(KEY_API, apiKey.trim())
                .apply()
        }
    }
}
