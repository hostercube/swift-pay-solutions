package bd.paynoc.merchant.ui

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import bd.paynoc.merchant.data.EventStore
import bd.paynoc.merchant.data.QueuedEvent
import bd.paynoc.merchant.data.Settings
import kotlinx.coroutines.launch

/**
 * Premium single-screen Compose UI: setup card (Backend URL + API key),
 * SMS permission prompt, live queue status, and the latest 200 parsed SMS.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(Modifier.fillMaxSize()) { HomeScreen() }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeScreen() {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    var settings by remember { mutableStateOf(Settings.load(ctx)) }
    var backend by remember { mutableStateOf(settings.backendUrl.orEmpty()) }
    var apiKey by remember { mutableStateOf(settings.apiKey.orEmpty()) }
    var events by remember { mutableStateOf<List<QueuedEvent>>(emptyList()) }

    val smsPermission = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions(),
    ) { /* granted state handled by system */ }

    LaunchedEffect(Unit) {
        smsPermission.launch(arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS))
        events = EventStore.get(ctx).recent()
    }

    Scaffold(topBar = { TopAppBar(title = { Text("PayNOC Merchant") }) }) { pad ->
        Column(
            Modifier.padding(pad).padding(16.dp).fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            ElevatedCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Connection", style = MaterialTheme.typography.titleMedium)
                    OutlinedTextField(
                        value = backend, onValueChange = { backend = it },
                        label = { Text("Backend URL") },
                        placeholder = { Text("https://paynoc.bd") },
                        singleLine = true, modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = apiKey, onValueChange = { apiKey = it },
                        label = { Text("API Key") },
                        placeholder = { Text("sk_live_…") },
                        singleLine = true, modifier = Modifier.fillMaxWidth(),
                    )
                    Button(
                        onClick = {
                            Settings.save(ctx, backend, apiKey)
                            settings = Settings.load(ctx)
                        },
                        enabled = backend.isNotBlank() && apiKey.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Save & activate") }
                    settings.apiKey?.let {
                        AssistChip(onClick = {}, label = { Text("Device ${settings.deviceId.take(8)}") })
                    }
                }
            }

            Text("Recent SMS", style = MaterialTheme.typography.titleMedium)
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(events) { e ->
                    Card {
                        Column(Modifier.padding(12.dp)) {
                            Text("${e.provider.uppercase()} · Tk ${e.amount}", style = MaterialTheme.typography.titleSmall)
                            Text("TrxID ${e.trxId} · ${e.status}")
                            e.sender?.let { Text("From $it", style = MaterialTheme.typography.bodySmall) }
                        }
                    }
                }
            }

            Button(onClick = { scope.launch { events = EventStore.get(ctx).recent() } }) {
                Text("Refresh")
            }
        }
    }
}
