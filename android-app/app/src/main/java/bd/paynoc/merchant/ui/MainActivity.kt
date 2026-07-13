package bd.paynoc.merchant.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Https
import androidx.compose.material.icons.filled.Message
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import bd.paynoc.merchant.data.EventStore
import bd.paynoc.merchant.data.QueuedEvent
import bd.paynoc.merchant.data.Settings
import bd.paynoc.merchant.network.PayNocApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Brand tokens — mirror the web app's amber accent on a near-black canvas. */
private val Brand = Color(0xFFF59E0B)
private val BrandGlow = Color(0xFFFBBF24)
private val BgBase = Color(0xFF0A0A0B)
private val BgSurface = Color(0xFF141416)
private val BgSurfaceHi = Color(0xFF1C1C1F)
private val Border = Color(0x1FFFFFFF)
private val TextMuted = Color(0xFF9CA3AF)
private val Success = Color(0xFF10B981)
private val Danger = Color(0xFFEF4444)

private val PayNocColorScheme = darkColorScheme(
    primary = Brand,
    onPrimary = Color.Black,
    secondary = BrandGlow,
    background = BgBase,
    surface = BgSurface,
    surfaceVariant = BgSurfaceHi,
    outline = Border,
    onSurface = Color(0xFFF5F5F5),
    onSurfaceVariant = TextMuted,
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = PayNocColorScheme) {
                Surface(Modifier.fillMaxSize(), color = BgBase) { HomeScreen() }
            }
        }
    }
}

private enum class HealthState { Unknown, Checking, Ok, Fail }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeScreen() {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()

    var settings by remember { mutableStateOf(Settings.load(ctx)) }
    var events by remember { mutableStateOf<List<QueuedEvent>>(emptyList()) }
    var health by remember { mutableStateOf(HealthState.Unknown) }
    var healthMsg by remember { mutableStateOf<String?>(null) }
    var showConfig by remember { mutableStateOf(!settings.isConfigured) }
    var toast by remember { mutableStateOf<String?>(null) }

    val hasSmsPermission = remember { mutableStateOf(hasSmsPermission(ctx)) }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted ->
        hasSmsPermission.value =
            granted[Manifest.permission.RECEIVE_SMS] == true &&
                granted[Manifest.permission.READ_SMS] == true
    }

    LaunchedEffect(Unit) {
        val perms = mutableListOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS)
        if (Build.VERSION.SDK_INT >= 33) perms += Manifest.permission.POST_NOTIFICATIONS
        if (!hasSmsPermission.value) permissionLauncher.launch(perms.toTypedArray())
    }

    // Poll the local queue every 3s for a live feel.
    LaunchedEffect(Unit) {
        while (true) {
            events = withContext(Dispatchers.IO) { EventStore.get(ctx).recent() }
            delay(3000)
        }
    }

    val stats = remember(events) { computeStats(events) }
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(toast) {
        toast?.let { snackbar.showSnackbar(it); toast = null }
    }

    Scaffold(
        containerColor = BgBase,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BrandMark()
                        Spacer(Modifier.width(10.dp))
                        Text("PayNOC Merchant", fontWeight = FontWeight.SemiBold)
                    }
                },
                actions = {
                    IconButton(onClick = { showConfig = true }) {
                        Icon(Icons.Filled.Bolt, contentDescription = "Configure", tint = Brand)
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = BgBase,
                    titleContentColor = Color.White,
                ),
            )
        },
    ) { pad ->
        LazyColumn(
            Modifier.padding(pad).fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item { HeroStatus(settings, hasSmsPermission.value, health, healthMsg) }
            item {
                StatsRow(
                    pending = stats.pending,
                    matchedToday = stats.matchedToday,
                    failed = stats.failed,
                )
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                val store = EventStore.get(ctx)
                                val requeued = withContext(Dispatchers.IO) {
                                    val n = store.requeueFailed()
                                    events = store.recent()
                                    n
                                }
                                if (requeued > 0) {
                                    androidx.work.WorkManager.getInstance(ctx).enqueueUniqueWork(
                                        bd.paynoc.merchant.work.UploadWorker.UNIQUE_NAME,
                                        androidx.work.ExistingWorkPolicy.APPEND_OR_REPLACE,
                                        androidx.work.OneTimeWorkRequestBuilder<bd.paynoc.merchant.work.UploadWorker>()
                                            .setConstraints(bd.paynoc.merchant.work.UploadWorker.constraints())
                                            .build(),
                                    )
                                    toast = "Re-queued $requeued failed event${if (requeued == 1) "" else "s"}"
                                } else {
                                    toast = "Nothing to retry"
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(Icons.Filled.Refresh, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Retry failed")
                    }
                    Button(
                        onClick = {
                            if (!settings.isConfigured) { showConfig = true; return@Button }
                            scope.launch {
                                health = HealthState.Checking
                                healthMsg = null
                                val result = withContext(Dispatchers.IO) {
                                    runCatching {
                                        PayNocApi.create(settings.backendUrl!!, settings.apiKey!!).ping()
                                    }
                                }
                                result.onSuccess { code ->
                                    if (code in 200..299) { health = HealthState.Ok; healthMsg = "Connected · HTTP $code" }
                                    else { health = HealthState.Fail; healthMsg = "HTTP $code — check API key" }
                                }.onFailure {
                                    health = HealthState.Fail
                                    healthMsg = it.message?.take(80) ?: "Network error"
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Brand, contentColor = Color.Black),
                    ) {
                        Icon(Icons.Filled.CloudSync, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Test connection", fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            item {
                SectionHeader(icon = Icons.Filled.Sms, title = "Recent messages", count = events.size)
            }

            if (events.isEmpty()) {
                item { EmptyState() }
            } else {
                items(events, key = { it.id }) { e -> EventRow(e) }
            }

            item { Footer() }
        }
    }

    if (showConfig) {
        ConfigSheet(
            initial = settings,
            onDismiss = { showConfig = false },
            onSave = { url, key ->
                when (val r = Settings.save(ctx, url, key)) {
                    is Settings.Companion.SaveResult.Ok -> {
                        settings = Settings.load(ctx)
                        bd.paynoc.merchant.system.ListenerService.start(ctx)
                        toast = "Saved securely"
                        showConfig = false
                    }
                    is Settings.Companion.SaveResult.Invalid -> {
                        toast = r.message
                    }
                }
            },
            onClear = {
                Settings.clear(ctx)
                settings = Settings.load(ctx)
                bd.paynoc.merchant.system.ListenerService.stop(ctx)
                toast = "Credentials cleared"
            },
        )
    }
}

/* -------------------- pieces -------------------- */

@Composable
private fun BrandMark() {
    Box(
        Modifier
            .size(30.dp)
            .clip(RoundedCornerShape(9.dp))
            .background(Brush.linearGradient(listOf(Brand, BrandGlow))),
        contentAlignment = Alignment.Center,
    ) { Text("P", color = Color.Black, fontWeight = FontWeight.Black, fontSize = 16.sp) }
}

@Composable
private fun HeroStatus(
    settings: Settings,
    hasSms: Boolean,
    health: HealthState,
    healthMsg: String?,
) {
    val (label, subtitle, tint) = when {
        !settings.isConfigured -> Triple("Not configured", "Tap the ⚡ icon and paste your backend + API key", Danger)
        !hasSms -> Triple("Waiting for SMS permission", "Grant Receive/Read SMS so payment texts can be parsed", Danger)
        health == HealthState.Ok -> Triple("All systems go", healthMsg ?: "Connected · listening for payment SMS", Success)
        health == HealthState.Fail -> Triple("Connection issue", healthMsg ?: "Backend is unreachable", Danger)
        health == HealthState.Checking -> Triple("Checking…", "Contacting the PayNOC backend", Brand)
        else -> Triple("Listening", "Auto-verifying incoming payment SMS in the background", Success)
    }

    Surface(
        color = BgSurface,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Border, RoundedCornerShape(20.dp)),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(10.dp).clip(RoundedCornerShape(50)).background(tint),
                )
                Spacer(Modifier.width(8.dp))
                Text(label, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }
            Text(subtitle, color = TextMuted, fontSize = 13.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Badge(if (settings.isConfigured) "Configured" else "No key", if (settings.isConfigured) Success else Danger)
                Badge(if (hasSms) "SMS permission" else "No permission", if (hasSms) Success else Danger)
                Badge("HTTPS", Success, leading = { Icon(Icons.Filled.Https, null, Modifier.size(11.dp), tint = Color.Black) })
            }
            settings.deviceId.let {
                Text("Device ${it.take(8)}", color = TextMuted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun Badge(text: String, color: Color, leading: (@Composable () -> Unit)? = null) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(color)
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) { leading(); Spacer(Modifier.width(4.dp)) }
        Text(text, color = Color.Black, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun StatsRow(pending: Int, matchedToday: Int, failed: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatCard("Pending", pending, Brand, Modifier.weight(1f))
        StatCard("Verified today", matchedToday, Success, Modifier.weight(1f))
        StatCard("Failed", failed, Danger, Modifier.weight(1f))
    }
}

@Composable
private fun StatCard(label: String, value: Int, accent: Color, modifier: Modifier = Modifier) {
    Surface(
        color = BgSurface,
        shape = RoundedCornerShape(16.dp),
        modifier = modifier.border(1.dp, Border, RoundedCornerShape(16.dp)),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(label, color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(4.dp))
            Text(value.toString(), color = accent, fontSize = 26.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun SectionHeader(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, count: Int) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Brand, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(6.dp))
        Text(title, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Spacer(Modifier.weight(1f))
        Text("$count", color = TextMuted, fontSize = 12.sp)
    }
}

@Composable
private fun EmptyState() {
    Surface(
        color = BgSurface,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Border, RoundedCornerShape(16.dp)),
    ) {
        Column(
            Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(Icons.Filled.Message, null, tint = TextMuted, modifier = Modifier.size(28.dp))
            Text("No payment SMS yet", color = Color.White, fontWeight = FontWeight.SemiBold)
            Text(
                "As soon as a payment SMS arrives it'll be parsed, queued, and uploaded here.",
                color = TextMuted, fontSize = 12.sp,
            )
        }
    }
}

@Composable
private fun EventRow(e: QueuedEvent) {
    val (chipColor, chipLabel) = when (e.status) {
        "matched" -> Success to "AUTO-VERIFIED"
        "unmatched" -> TextMuted to "UPLOADED"
        "failed" -> Danger to "FAILED"
        "sent" -> Success to "SENT" // legacy rows from older schema
        else -> Brand to "PENDING"
    }
    val noteColor = if (e.status == "failed") Danger else TextMuted
    Surface(
        color = BgSurface,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Border, RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "৳ ${formatAmount(e.amount)}",
                    color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp,
                )
                Spacer(Modifier.width(8.dp))
                Text(e.provider.uppercase(), color = Brand, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                Badge(chipLabel, chipColor)
            }
            Text("TrxID ${e.trxId}", color = TextMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            e.sender?.let { Text("From $it", color = TextMuted, fontSize = 11.sp) }
            e.invoiceId?.let {
                Text("Invoice ${it.take(8)}", color = Success, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            e.note?.let {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (e.status == "failed") {
                        Icon(Icons.Filled.ErrorOutline, null, tint = Danger, modifier = Modifier.size(11.dp))
                        Spacer(Modifier.width(4.dp))
                    }
                    Text(it, color = noteColor, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun Footer() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.CheckCircle, null, tint = Success, modifier = Modifier.size(12.dp))
        Spacer(Modifier.width(4.dp))
        Text("Encrypted at rest · HTTPS only · Auto-retry", color = TextMuted, fontSize = 10.sp)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ConfigSheet(
    initial: Settings,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit,
    onClear: () -> Unit,
) {
    var backend by remember { mutableStateOf(initial.backendUrl.orEmpty()) }
    var apiKey by remember { mutableStateOf(initial.apiKey.orEmpty()) }
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = state,
        containerColor = BgSurface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = Border) },
    ) {
        Column(
            Modifier.padding(horizontal = 20.dp, vertical = 8.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Connect this device", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
            Text(
                "Paste your backend URL (must be https://) and the sk_live_… / sk_test_… key from Security → Devices.",
                color = TextMuted, fontSize = 12.sp,
            )
            OutlinedTextField(
                value = backend, onValueChange = { backend = it },
                label = { Text("Backend URL") },
                placeholder = { Text("https://your-app.lovable.app") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = apiKey, onValueChange = { apiKey = it },
                label = { Text("API Key") },
                placeholder = { Text("sk_live_…") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (initial.isConfigured) {
                    OutlinedButton(onClick = onClear, modifier = Modifier.weight(1f)) { Text("Clear") }
                }
                Button(
                    onClick = { onSave(backend, apiKey) },
                    enabled = backend.isNotBlank() && apiKey.isNotBlank(),
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Brand, contentColor = Color.Black),
                ) { Text("Save securely", fontWeight = FontWeight.SemiBold) }
            }
        }
    }
}

/* -------------------- helpers -------------------- */

private data class Stats(val pending: Int, val matchedToday: Int, val failed: Int)

private fun computeStats(events: List<QueuedEvent>): Stats {
    val today = java.time.LocalDate.now(java.time.ZoneOffset.UTC).toString()
    var pending = 0; var matchedToday = 0; var failed = 0
    for (e in events) when (e.status) {
        "pending" -> pending++
        "failed" -> failed++
        "matched" -> if (e.receivedAtIso.startsWith(today)) matchedToday++
    }
    return Stats(pending, matchedToday, failed)
}

private fun hasSmsPermission(ctx: android.content.Context): Boolean =
    ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECEIVE_SMS) ==
        PackageManager.PERMISSION_GRANTED &&
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
        PackageManager.PERMISSION_GRANTED

private fun formatAmount(amount: Double): String =
    if (amount % 1.0 == 0.0) "%,d".format(amount.toLong())
    else "%,.2f".format(amount)
