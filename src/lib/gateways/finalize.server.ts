export type BkashExecute = {
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  merchantInvoiceNumber?: string;
  amount?: string;
  currency?: string;
  statusCode?: string;
  statusMessage?: string;
  errorMessage?: string;
};

export async function bkashExecute(
  creds: Record<string, string>, mode: "sandbox" | "live", paymentID: string,
): Promise<BkashExecute | null> {
  const base = mode === "live"
    ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
    : "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
  const tokRes = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", accept: "application/json",
      username: creds.username, password: creds.password,
    },
    body: JSON.stringify({ app_key: creds.app_key, app_secret: creds.app_secret }),
  });
  const tok = (await tokRes.json()) as { id_token?: string };
  if (!tok.id_token) return null;
  const exec = await fetch(`${base}/tokenized/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", accept: "application/json",
      Authorization: tok.id_token, "X-App-Key": creds.app_key,
    },
    body: JSON.stringify({ paymentID }),
  });
  return (await exec.json().catch(() => null)) as BkashExecute | null;
}