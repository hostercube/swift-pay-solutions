import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Smartphone, RefreshCw, Download, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveMerchant } from "@/hooks/use-active-merchant";

export const Route = createFileRoute("/_authenticated/security/devices")({
  head: () => ({ meta: [{ title: "Connect device (APK) · PayNOC" }] }),
  component: DevicesPage,
});

/**
 * Portal → APK pairing. We don't invent a new auth flow — the APK already
 * authenticates with the same `sk_live_*` / `sk_test_*` API keys the REST
 * API uses. This page just makes onboarding trivial: pick an existing key
 * (or create one), and get a QR code that encodes `{ backend_url, api_key }`
 * so the APK's "Scan to connect" screen can restore both fields at once.
 */
type KeyRow = {
  id: string;
  name: string;
  environment: "test" | "live";
  public_key: string;
  is_active: boolean;
};

function randomKey(prefix: string) {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}
async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function DevicesPage() {
  const { user } = useAuth();
  const { merchantId: activeMerchantId } = useActiveMerchant();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const backendUrl = typeof window !== "undefined" ? window.location.origin : "";
  const selectedKey = useMemo(() => keys.find((k) => k.id === selectedKeyId), [keys, selectedKeyId]);

  async function loadKeys() {
    if (!user) return;
    const { data } = await supabase
      .from("api_keys")
      .select("id, name, environment, public_key, is_active")
      .eq("merchant_id", activeMerchantId ?? user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as KeyRow[];
    setKeys(rows);
    if (!selectedKeyId && rows.length > 0) setSelectedKeyId(rows[0].id);
  }
  useEffect(() => { loadKeys(); }, [user, activeMerchantId]);

  async function mintDeviceKey() {
    if (!user) return;
    setBusy(true);
    const publicKey = randomKey("pk_live");
    const rawSecret = randomKey("sk_live");
    const secretHash = await sha256Hex(rawSecret);
    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        merchant_id: activeMerchantId ?? user.id,
        name: `APK · Device ${new Date().toLocaleDateString()}`,
        environment: "live",
        public_key: publicKey,
        secret_hash: secretHash,
      })
      .select("id, name, environment, public_key, is_active")
      .single();
    setBusy(false);
    if (error || !data) return toast.error(error?.message || "Failed to create key");
    setSecret(rawSecret);
    setSelectedKeyId(data.id);
    toast.success("Device key created — scan the QR from your APK now.");
    loadKeys();
  }

  // Regenerate QR whenever we have a key + secret pair to encode.
  useEffect(() => {
    if (!selectedKey || !secret || !backendUrl) { setQrDataUrl(""); return; }
    const payload = JSON.stringify({
      v: 1,
      backend_url: backendUrl,
      api_key: secret,
      device_name: selectedKey.name,
      env: selectedKey.environment,
    });
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 340 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [selectedKey, secret, backendUrl]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="glass rounded-2xl border border-glass-border p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Connect your Android device</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The PayNOC Merchant APK listens to your bKash / Nagad / Rocket / bank SMS on the phone
                that owns the merchant number, and auto-verifies matching pending invoices in your
                dashboard. To connect: mint a device key here, then scan the QR from the APK's
                <em className="mx-1">Scan to connect</em> screen.
              </p>
            </div>
          </div>

          <ol className="mt-6 space-y-3 text-sm">
            <StepItem n={1} title="Install the APK">
              Download the latest{" "}
              <a href="/api/public/apk/merchant" className="text-brand hover:underline">PayNOC Merchant APK</a>
              {" "}on your Android phone. In the phone settings, allow install from unknown sources for your
              browser, then open the .apk file to install.
            </StepItem>
            <StepItem n={2} title="Mint a device key">
              Every device needs its own API key so you can revoke that phone independently. Click
              <em className="mx-1">Create device key</em> below — the secret is shown once, encoded into the
              QR code, and never revealed again.
            </StepItem>
            <StepItem n={3} title="Scan or paste">
              Open the APK, tap <em>Scan to connect</em>, and point it at the QR shown here. If you
              can't scan, tap <em>Enter manually</em> and paste the Backend URL + secret shown below.
            </StepItem>
            <StepItem n={4} title="Grant SMS permission">
              Android will ask for SMS read permission. Grant it — the APK reads only the sender/amount/
              transaction ID from provider SMS and forwards them to <code className="font-mono text-xs">/api/public/v1/sms-events</code>
              over HTTPS. No SMS is stored on our servers.
            </StepItem>
            <StepItem n={5} title="Test one payment">
              Create a test invoice, pay it from a real customer number, and confirm the invoice flips to
              <em className="mx-1">completed</em> in your dashboard within a few seconds of the SMS arriving.
            </StepItem>
          </ol>
        </div>

        <div className="glass mt-6 rounded-2xl border border-glass-border p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand" />
            <h3 className="font-display text-lg font-semibold">Security</h3>
          </div>
          <ul className="mt-3 ml-5 list-disc space-y-1.5 text-sm text-muted-foreground">
            <li>Device keys are stored encrypted (AES-256) on the phone via Android EncryptedSharedPreferences.</li>
            <li>Every SMS event batch is signed with your API key and cross-checked against a pending transaction with the exact TrxID — the APK cannot verify random payments.</li>
            <li>Lose the phone? Disable the device key on the <a href="/security/api-keys" className="text-brand hover:underline">API keys</a> page and it stops working immediately.</li>
            <li>Set an IP whitelist on <a href="/security/ip-whitelist" className="text-brand hover:underline">Security → IP whitelist</a> if your phone has a static IP.</li>
          </ul>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="glass rounded-2xl border border-glass-border p-5">
          <label className="block">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Existing device key</div>
            <select
              value={selectedKeyId}
              onChange={(e) => { setSelectedKeyId(e.target.value); setSecret(""); }}
              className="w-full rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {keys.length === 0 && <option value="">No active keys yet</option>}
              {keys.map((k) => (
                <option key={k.id} value={k.id}>{k.name} · {k.environment}</option>
              ))}
            </select>
          </label>
          <button
            onClick={mintDeviceKey}
            disabled={busy}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Creating…" : "Create device key"}
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Creates a new <code className="font-mono">sk_live_…</code> key labelled "APK · Device …". You'll see it in
            <a href="/security/api-keys" className="ml-1 text-brand hover:underline">API keys</a> where you can revoke it.
          </p>
        </div>

        <div className="glass rounded-2xl border border-glass-border p-5">
          <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Scan from APK</div>
          <div className="mx-auto grid aspect-square w-full max-w-[300px] place-items-center rounded-xl border border-glass-border bg-white p-3">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="APK pairing QR code" className="h-full w-full object-contain" />
            ) : (
              <div className="text-center text-xs text-muted-foreground">
                {secret
                  ? "Generating QR…"
                  : "Click 'Create device key' to mint a one-time secret and reveal the pairing QR."}
              </div>
            )}
          </div>

          {secret && (
            <div className="mt-4 space-y-2">
              <CopyRow label="Backend URL" value={backendUrl} />
              <CopyRow label="API secret" value={secret} monoBreak />
              <p className="text-[11px] text-warning">
                ⚠ This secret is shown once. Copy it now or leave this window open until the APK confirms pairing.
              </p>
            </div>
          )}
        </div>

        <a
          href="/api/public/apk/merchant"
          className="glass flex items-center gap-3 rounded-2xl border border-glass-border p-4 text-sm transition hover:border-brand/60"
        >
          <Download className="h-4 w-4 text-brand" />
          <div>
            <div className="font-medium">Download Merchant APK</div>
            <div className="text-xs text-muted-foreground">Android 8+ · signed APK</div>
          </div>
        </a>
      </aside>
    </div>
  );
}

function StepItem({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 text-[11px] font-semibold text-brand">
        {n}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function CopyRow({ label, value, monoBreak }: { label: string; value: string; monoBreak?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 rounded-md bg-background/60 px-2 py-1.5 font-mono text-[11px] ${
            monoBreak ? "break-all" : "truncate"
          }`}
        >
          {value}
        </code>
        <button
          onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
          className="rounded-md border border-glass-border p-1.5 hover:bg-muted"
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
