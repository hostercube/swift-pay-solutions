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
    console.warn(
      `WARNING: Backend auth endpoint returned HTTP ${response.status} at ${url.origin} from the build container. The site proxies /api/backend/* server-side, so this is only fatal if the runtime host also cannot reach the backend.`,
    );
  } else if (!contentType.includes("application/json") || /^\s*</.test(body)) {
    console.warn(
      `WARNING: Backend auth endpoint at ${url.origin} did not return JSON from the build container. Verify the domain maps to the API gateway, not Studio or the web app.`,
    );
  } else {
    JSON.parse(body);
    console.log(`Backend API verified at ${url.origin}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(
    `WARNING: Backend auth endpoint unreachable from the build container at ${url.origin} (${message}). Build continues; the runtime host must be able to reach it for the same-origin proxy to work.`,
  );
} finally {
  clearTimeout(timeout);
}