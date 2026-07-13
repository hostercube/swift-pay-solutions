type Creds = Record<string, string>;

export async function verifyBkash(mode: "live" | "test", creds: Creds, trxId: string) {
  const base = mode === "live"
    ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
    : "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
  const tokenRes = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      username: creds.username ?? "",
      password: creds.password ?? "",
    },
    body: JSON.stringify({ app_key: creds.app_key, app_secret: creds.app_secret }),
  });
  if (!tokenRes.ok) throw new Error(`bKash token failed: ${tokenRes.status}`);
  const tokenJson = (await tokenRes.json()) as { id_token?: string };
  const token = tokenJson.id_token;
  if (!token) throw new Error("bKash token missing");

  const statusRes = await fetch(`${base}/tokenized/checkout/payment/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      authorization: token,
      "x-app-key": creds.app_key ?? "",
    },
    body: JSON.stringify({ paymentID: trxId }),
  });
  const body = (await statusRes.json()) as {
    transactionStatus?: string; amount?: string; trxID?: string;
  };
  return {
    ok: (body.transactionStatus ?? "").toLowerCase() === "completed",
    amount: body.amount ? Number(body.amount) : undefined,
    providerRef: body.trxID,
    raw: body,
  };
}

export async function verifyNagad(mode: "live" | "test", creds: Creds, ref: string) {
  const base = mode === "live"
    ? "https://api.mynagad.com/api/dfs"
    : "https://sandbox-ssl.mynagad.com/api/dfs";
  const res = await fetch(`${base}/verify/payment/${encodeURIComponent(ref)}`, {
    method: "GET",
    headers: {
      "X-KM-Api-Version": "v-0.2.0",
      "X-KM-Client-Type": "PC_WEB",
      "X-KM-IP-V4": "0.0.0.0",
      "Content-Type": "application/json",
      accept: "application/json",
      "merchant-id": creds.merchant_id ?? "",
    },
  });
  const body = (await res.json()) as {
    status?: string; statusCode?: string; amount?: string; issuerPaymentRefNo?: string;
  };
  return {
    ok: body.status === "Success" || body.statusCode === "000",
    amount: body.amount ? Number(body.amount) : undefined,
    providerRef: body.issuerPaymentRefNo,
    raw: body,
  };
}

export async function verifyUddoktapay(_mode: "live" | "test", creds: Creds, invoiceId: string) {
  const base = String(creds.base_url ?? "").replace(/\/$/, "");
  if (!base) throw new Error("UddoktaPay base_url missing");
  const res = await fetch(`${base}/api/verify-payment`, {
    method: "POST",
    headers: {
      "RT-UDDOKTAPAY-API-KEY": creds.api_key ?? "",
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  const body = (await res.json()) as {
    status?: string; amount?: string; transaction_id?: string; sender_number?: string;
  };
  return {
    ok: (body.status ?? "").toUpperCase() === "COMPLETED",
    amount: body.amount ? Number(body.amount) : undefined,
    providerRef: body.transaction_id,
    raw: body,
  };
}