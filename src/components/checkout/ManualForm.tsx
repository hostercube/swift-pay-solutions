import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CopyBtn, Field, Info, currencySymbol, iconFor, inputCls, labelForType, STYLES,
} from "./primitives";
import { LocalQr, PayQr, qrFallbackEligible } from "./PaymentQr";
import type { Brand, CheckoutStyle, Invoice, ManualFormState, Method, Txn } from "./types";

const ALLOWED_SLIP_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SLIP_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Manual payment form — merchant account details + Trx ID entry + optional slip upload.
 * SMS auto-verify from the merchant APK will settle this txn once the payer's provider SMS
 * arrives on the merchant phone; until then the txn stays `pending`.
 */
export function ManualForm({
  method, inv, brand, form, setForm, onCancel, onSubmit, submitting, pending,
}: {
  method: Method;
  inv: Invoice;
  brand: Brand | null;
  form: ManualFormState;
  setForm: React.Dispatch<React.SetStateAction<ManualFormState>>;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  pending: Txn | null;
}) {
  const isBank = method.type === "bank_transfer";
  const [uploading, setUploading] = useState(false);
  const style = STYLES[(brand?.checkout_style as CheckoutStyle) ?? "premium"];

  async function uploadSlip(file: File) {
    if (!ALLOWED_SLIP_MIME.includes(file.type))
      return toast.error("Only JPG, PNG, WEBP, or PDF files are allowed");
    if (file.size > MAX_SLIP_BYTES)
      return toast.error(`File is too large — max ${Math.round(MAX_SLIP_BYTES / (1024 * 1024))}MB`);
    setUploading(true);
    try {
      const path = `slips/${inv.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("payment-assets")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      setForm((f) => ({ ...f, slip_url: path }));
      toast.success("Slip uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="glass-premium rounded-2xl p-5 sm:p-6">
      <button
        onClick={onCancel}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Choose another method
      </button>

      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand ring-1 ring-inset ring-brand/20">
          {iconFor(method.type)}
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Pay with</div>
          <div className="truncate font-display text-lg font-bold">{method.label}</div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-brand/20 bg-brand/5 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {isBank ? (
            <>
              {method.bank_name && <Info label="Bank"><div className="font-semibold">{method.bank_name}</div></Info>}
              {method.branch_name && <Info label="Branch"><div className="text-sm">{method.branch_name}</div></Info>}
              <Info label="Account number">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-base font-semibold">{method.account_number || "—"}</span>
                  {method.account_number && <CopyBtn text={method.account_number} />}
                </div>
              </Info>
              {method.account_name && <Info label="Account name"><div className="text-sm">{method.account_name}</div></Info>}
              {method.routing_number && (
                <Info label="Routing">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{method.routing_number}</span>
                    <CopyBtn text={method.routing_number} />
                  </div>
                </Info>
              )}
              {method.swift_code && (
                <Info label="SWIFT / IBAN">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{method.swift_code}</span>
                    <CopyBtn text={method.swift_code} />
                  </div>
                </Info>
              )}
            </>
          ) : (
            <Info label="Send money to">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-base font-semibold">{method.account_number || "—"}</span>
                {method.account_number && <CopyBtn text={method.account_number} />}
              </div>
              {method.account_name && (
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{method.account_name}</div>
              )}
            </Info>
          )}
          <Info label="Exact amount">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-base font-semibold tabular-nums">
                {currencySymbol(inv.currency)}{Number(inv.amount).toLocaleString()}
              </span>
              <CopyBtn text={String(inv.amount)} />
            </div>
          </Info>
        </div>

        {(() => {
          const hasFallback = qrFallbackEligible(method);
          if (!method.qr_code_url && !hasFallback) return null;
          return (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-brand/40 bg-background/40 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Scan to pay {method.qr_type ? `· ${method.qr_type.replace("_", " ")}` : ""}
              </div>
              {method.qr_code_url
                ? <PayQr path={method.qr_code_url} />
                : <LocalQr text={method.account_number!} />}
              <div className="text-[11px] text-muted-foreground">
                {method.qr_code_url
                  ? "Open your mobile banking app and scan the QR"
                  : `Scan with ${labelForType(method.type)} app · ${method.account_number}`}
              </div>
            </div>
          );
        })()}

        {method.instructions && (
          <div className="mt-3 whitespace-pre-line rounded-lg bg-background/40 p-3 text-xs text-muted-foreground">
            {method.instructions}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label={isBank ? "Your account / mobile number" : "Your number"}>
          <input
            value={form.sender_number}
            onChange={(e) => setForm((f) => ({ ...f, sender_number: e.target.value }))}
            className={inputCls}
            placeholder="01XXXXXXXXX"
          />
        </Field>
        <Field label="Your name (optional)">
          <input
            value={form.sender_name}
            onChange={(e) => setForm((f) => ({ ...f, sender_name: e.target.value }))}
            className={inputCls}
          />
        </Field>
        <Field label={isBank ? "Deposit slip / transaction ID" : "Transaction ID"} full>
          <input
            value={form.provider_txn_id}
            onChange={(e) => setForm((f) => ({ ...f, provider_txn_id: e.target.value }))}
            className={inputCls}
            placeholder="e.g. 8A7BXY123"
          />
        </Field>

        {isBank && (
          <>
            <Field label="Bank reference (optional)" full>
              <input
                value={form.bank_reference}
                onChange={(e) => setForm((f) => ({ ...f, bank_reference: e.target.value }))}
                className={inputCls}
                placeholder="e.g. cheque no. / online transfer ref"
              />
            </Field>
            <Field label="Upload bank slip (required)" full>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-glass-border bg-card/60 px-3 py-2 text-xs font-semibold transition hover:border-brand">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSlip(f); }}
                  />
                  {uploading ? "Uploading…" : form.slip_url ? "Replace slip" : "Choose file"}
                </label>
                {form.slip_url && <span className="text-xs text-success">✓ Slip attached</span>}
              </div>
            </Field>
          </>
        )}
      </div>

      {pending && (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <div className="font-semibold text-amber-600">Awaiting verification</div>
          <div className="mt-1 text-xs text-muted-foreground">
            You already submitted TrxID <span className="font-mono">{pending.provider_txn_id}</span> on{" "}
            {new Date(pending.created_at).toLocaleString()}. The merchant will confirm shortly.
          </div>
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={submitting || !!pending}
        className={`mt-6 w-full rounded-xl py-3.5 text-sm font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${style.ctaBg}`}
      >
        {pending
          ? "Submission pending review"
          : submitting
            ? "Submitting…"
            : `Confirm & Pay ${currencySymbol(inv.currency)}${Number(inv.amount).toLocaleString()}`}
      </button>
    </div>
  );
}
