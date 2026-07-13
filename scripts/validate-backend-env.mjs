const env = process.env;

const backendUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const publishableKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_ANON_KEY;

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!backendUrl) {
  fail(
    "Backend URL is empty. Set VITE_SUPABASE_URL or SUPABASE_URL to the public API gateway, for example https://db.paynoc.com.",
  );
}

if (!publishableKey) {
  fail(
    "Publishable/anon key is empty. Set VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_PUBLISHABLE_KEY from the backend anon key.",
  );
}

let url;
try {
  url = new URL(backendUrl);
} catch {
  fail(`Backend URL is invalid: ${backendUrl}`);
}

if (url.protocol !== "https:" && url.hostname !== "localhost") {
  fail(`Backend URL must use HTTPS in production: ${backendUrl}`);
}

url.pathname = "/auth/v1/settings";
url.search = "";
url.hash = "";

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  const response = await fetch(url, {
    headers: { apikey: publishableKey },
    signal: controller.signal,
  });
  const contentType = response.headers.get("content-type") || "";
  const body = await response.clone().text();

  if (!response.ok) {
    fail(
      `Backend auth endpoint returned HTTP ${response.status} at ${url.origin}. Make sure this domain points to the backend API gateway, not the web app or Studio.`,
    );
  }

  if (!contentType.includes("application/json") || /^\s*</.test(body)) {
    fail(
      `Backend auth endpoint at ${url.origin} did not return JSON. This usually means the domain is mapped to the wrong service.`,
    );
  }

  JSON.parse(body);
  console.log(`Backend API verified at ${url.origin}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(
    `Backend auth endpoint is unreachable at ${url.origin}. Fix DNS/SSL/CORS or set VITE_SUPABASE_URL/SUPABASE_URL to the working API gateway. Details: ${message}`,
  );
} finally {
  clearTimeout(timeout);
}