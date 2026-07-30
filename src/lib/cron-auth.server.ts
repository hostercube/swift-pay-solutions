/**
 * Shared guard for the scheduled-job endpoints under /api/public/hooks/*.
 *
 * These routes run privileged work with the service-role key (sending
 * notifications, retrying webhooks, expiring invoices...). The `/api/public/`
 * prefix bypasses site auth, so without this guard anyone on the internet
 * could hammer them.
 *
 * Auth: send the shared secret as either
 *   x-cron-secret: <CRON_SECRET>
 *   Authorization: Bearer <CRON_SECRET>
 *
 * If CRON_SECRET is not configured on the server the request is allowed
 * (with a warning) so existing deployments keep working until the operator
 * sets the variable. Set it in production — see DEPLOY.md.
 */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function assertCronRequest(request: Request): Response | null {
  const env =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const secret = (env.CRON_SECRET ?? "").trim();

  if (!secret) {
    console.warn(
      "[cron] CRON_SECRET is not set — scheduled-job endpoints are unauthenticated. Set CRON_SECRET.",
    );
    return null;
  }

  const header = request.headers.get("x-cron-secret")?.trim() ?? "";
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (timingSafeEqual(header, secret) || timingSafeEqual(bearer, secret)) return null;

  return Response.json({ error: "unauthorized" }, { status: 401 });
}
