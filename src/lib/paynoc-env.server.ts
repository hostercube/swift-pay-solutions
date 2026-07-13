type EnvMap = Record<string, string | undefined>;

const readProcessEnv = (): EnvMap =>
  ((globalThis as { process?: { env?: EnvMap } }).process?.env ?? {}) as EnvMap;

const firstDefined = (env: EnvMap, names: readonly string[]) => {
  for (const name of names) {
    const value = env[name];
    if (value && value.trim()) return value;
  }
  return undefined;
};

export const PAYNOC_ENV_NAMES = {
  url: [
    "VITE_SUPABASE_URL",
    "PAYNOC_PRODUCTION_SUPABASE_URL",
    "PAYNOC_PROD_SUPABASE_URL",
    "PAYNOC_SUPABASE_URL",
    "SUPABASE_URL",
    "SERVICE_URL_SUPABASEKONG",
    "SERVICE_URL_SUPABASEKONG_8000",
  ],
  anonKey: [
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "PAYNOC_PRODUCTION_SUPABASE_ANON_KEY",
    "PAYNOC_PRODUCTION_SUPABASE_PUBLISHABLE_KEY",
    "PAYNOC_PROD_SUPABASE_ANON_KEY",
    "PAYNOC_PROD_SUPABASE_PUBLISHABLE_KEY",
    "PAYNOC_SUPABASE_ANON_KEY",
    "PAYNOC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "SERVICE_SUPABASEANON_KEY",
  ],
  serviceRoleKey: [
    "PAYNOC_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY",
    "PAYNOC_PROD_SUPABASE_SERVICE_ROLE_KEY",
    "PAYNOC_SUPABASE_SERVICE_ROLE_KEY",
    "SERVICE_SUPABASESERVICE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ],
  jwtSecret: [
    "PAYNOC_PRODUCTION_SUPABASE_JWT_SECRET",
    "PAYNOC_PROD_SUPABASE_JWT_SECRET",
    "PAYNOC_SUPABASE_JWT_SECRET",
    "SERVICE_PASSWORD_JWT",
    "SUPABASE_JWT_SECRET",
  ],
  projectId: [
    "VITE_SUPABASE_PROJECT_ID",
    "PAYNOC_PRODUCTION_SUPABASE_PROJECT_ID",
    "PAYNOC_PROD_SUPABASE_PROJECT_ID",
    "PAYNOC_SUPABASE_PROJECT_ID",
    "SUPABASE_PROJECT_ID",
  ],
} as const;

// Group resolution: pick a paired set of (url, anonKey, serviceRoleKey) from the
// same source so a Lovable-hosted URL is never paired with a self-hosted
// service key (which returns PGRST301 "No suitable key or wrong key type").
const PAYNOC_ENV_GROUPS: Array<{
  url: string;
  anonKey: string[];
  serviceRoleKey: string[];
  jwtSecret?: string[];
  projectId?: string[];
}> = [
  // Prefer the URL the browser client uses (VITE_SUPABASE_URL) so admin/server
  // calls target the same project as the browser session. Mixing a Lovable URL
  // with a self-hosted service role key causes PGRST301 "No suitable key or
  // wrong key type".
  {
    url: "VITE_SUPABASE_URL",
    anonKey: ["VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"],
    serviceRoleKey: ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_SUPABASESERVICE_KEY"],
    jwtSecret: ["SUPABASE_JWT_SECRET", "SERVICE_PASSWORD_JWT"],
    projectId: ["VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID"],
  },
  {
    url: "SUPABASE_URL",
    anonKey: ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "SERVICE_SUPABASEANON_KEY"],
    serviceRoleKey: ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_SUPABASESERVICE_KEY"],
    jwtSecret: ["SUPABASE_JWT_SECRET", "SERVICE_PASSWORD_JWT"],
    projectId: ["SUPABASE_PROJECT_ID"],
  },
  {
    url: "PAYNOC_PRODUCTION_SUPABASE_URL",
    anonKey: ["PAYNOC_PRODUCTION_SUPABASE_ANON_KEY", "PAYNOC_PRODUCTION_SUPABASE_PUBLISHABLE_KEY"],
    serviceRoleKey: ["PAYNOC_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY"],
    jwtSecret: ["PAYNOC_PRODUCTION_SUPABASE_JWT_SECRET"],
    projectId: ["PAYNOC_PRODUCTION_SUPABASE_PROJECT_ID"],
  },
  {
    url: "PAYNOC_PROD_SUPABASE_URL",
    anonKey: ["PAYNOC_PROD_SUPABASE_ANON_KEY", "PAYNOC_PROD_SUPABASE_PUBLISHABLE_KEY"],
    serviceRoleKey: ["PAYNOC_PROD_SUPABASE_SERVICE_ROLE_KEY"],
    jwtSecret: ["PAYNOC_PROD_SUPABASE_JWT_SECRET"],
    projectId: ["PAYNOC_PROD_SUPABASE_PROJECT_ID"],
  },
  {
    url: "PAYNOC_SUPABASE_URL",
    anonKey: ["PAYNOC_SUPABASE_ANON_KEY", "PAYNOC_SUPABASE_PUBLISHABLE_KEY"],
    serviceRoleKey: ["PAYNOC_SUPABASE_SERVICE_ROLE_KEY"],
    jwtSecret: ["PAYNOC_SUPABASE_JWT_SECRET"],
    projectId: ["PAYNOC_SUPABASE_PROJECT_ID"],
  },
  {
    url: "SERVICE_URL_SUPABASEKONG",
    anonKey: ["SERVICE_SUPABASEANON_KEY"],
    serviceRoleKey: ["SERVICE_SUPABASESERVICE_KEY"],
    jwtSecret: ["SERVICE_PASSWORD_JWT"],
    projectId: [],
  },
  {
    url: "SERVICE_URL_SUPABASEKONG_8000",
    anonKey: ["SERVICE_SUPABASEANON_KEY"],
    serviceRoleKey: ["SERVICE_SUPABASESERVICE_KEY"],
    jwtSecret: ["SERVICE_PASSWORD_JWT"],
    projectId: [],
  },
];

export function getPaynocBackendEnv(env: EnvMap = readProcessEnv()) {
  // Pick the first group whose URL is defined; that group's keys pair together.
  let url: string | undefined;
  let anonKey: string | undefined;
  let serviceRoleKey: string | undefined;
  let jwtSecret: string | undefined;
  let projectId: string | undefined;

  for (const group of PAYNOC_ENV_GROUPS) {
    const u = env[group.url];
    if (!u || !u.trim()) continue;
    url = u.trim();
    anonKey = firstDefined(env, group.anonKey);
    serviceRoleKey = firstDefined(env, group.serviceRoleKey);
    jwtSecret = firstDefined(env, group.jwtSecret ?? []);
    projectId = firstDefined(env, group.projectId ?? []);
    // Prefer groups that have a service role key when we care about admin ops;
    // but if this group has anon at least, accept and stop — callers that need
    // serviceRoleKey will error via requirePaynocBackendEnv.
    if (anonKey || serviceRoleKey) break;
  }

  return { url, anonKey, serviceRoleKey, jwtSecret, projectId: projectId ?? "paynoc" };
}

export function requirePaynocBackendEnv(
  keys: Array<"url" | "anonKey" | "serviceRoleKey">,
  env: EnvMap = readProcessEnv(),
) {
  const resolved = getPaynocBackendEnv(env);
  const missing = keys.filter((key) => !resolved[key]);

  if (missing.length) {
    throw new Error(
      `Missing Paynoc backend environment variable(s): ${missing.join(
        ", ",
      )}. Configure the PAYNOC/Coolify backend env names, not the managed defaults.`,
    );
  }

  return resolved as typeof resolved & {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
}

export function applyPaynocBackendEnv(runtimeEnv?: unknown) {
  const processEnv = readProcessEnv();
  const runtimeMap =
    runtimeEnv && typeof runtimeEnv === "object"
      ? (runtimeEnv as EnvMap)
      : undefined;

  if (runtimeMap) {
    for (const [key, value] of Object.entries(runtimeMap)) {
      if (typeof value === "string" && !processEnv[key]) {
        processEnv[key] = value;
      }
    }
  }

  const resolved = getPaynocBackendEnv(processEnv);
  if (resolved.url) processEnv.SUPABASE_URL = resolved.url;
  if (resolved.anonKey) {
    processEnv.SUPABASE_PUBLISHABLE_KEY = resolved.anonKey;
    processEnv.SUPABASE_ANON_KEY = resolved.anonKey;
  }
  if (resolved.serviceRoleKey) {
    processEnv.SUPABASE_SERVICE_ROLE_KEY = resolved.serviceRoleKey;
  }
  if (resolved.jwtSecret) processEnv.SUPABASE_JWT_SECRET = resolved.jwtSecret;
  processEnv.SUPABASE_PROJECT_ID = resolved.projectId;
}