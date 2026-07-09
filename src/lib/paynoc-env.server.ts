type EnvMap = Record<string, string | undefined>;

const readProcessEnv = (): EnvMap =>
  ((globalThis as { process?: { env?: EnvMap } }).process?.env ?? {}) as EnvMap;

const firstDefined = (env: EnvMap, names: string[]) => {
  for (const name of names) {
    const value = env[name];
    if (value && value.trim()) return value;
  }
  return undefined;
};

export const PAYNOC_ENV_NAMES = {
  url: [
    "PAYNOC_SUPABASE_URL",
    "PAYNOC_PRODUCTION_SUPABASE_URL",
    "PAYNOC_PROD_SUPABASE_URL",
    "SERVICE_URL_SUPABASEKONG",
    "SERVICE_URL_SUPABASEKONG_8000",
    "SUPABASE_URL",
  ],
  anonKey: [
    "PAYNOC_SUPABASE_ANON_KEY",
    "PAYNOC_SUPABASE_PUBLISHABLE_KEY",
    "PAYNOC_PRODUCTION_SUPABASE_ANON_KEY",
    "PAYNOC_PROD_SUPABASE_ANON_KEY",
    "SERVICE_SUPABASEANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  ],
  serviceRoleKey: [
    "PAYNOC_SUPABASE_SERVICE_ROLE_KEY",
    "PAYNOC_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY",
    "PAYNOC_PROD_SUPABASE_SERVICE_ROLE_KEY",
    "SERVICE_SUPABASESERVICE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ],
  jwtSecret: [
    "PAYNOC_SUPABASE_JWT_SECRET",
    "PAYNOC_PRODUCTION_SUPABASE_JWT_SECRET",
    "PAYNOC_PROD_SUPABASE_JWT_SECRET",
    "SERVICE_PASSWORD_JWT",
    "SUPABASE_JWT_SECRET",
  ],
  projectId: [
    "PAYNOC_SUPABASE_PROJECT_ID",
    "PAYNOC_PRODUCTION_SUPABASE_PROJECT_ID",
    "PAYNOC_PROD_SUPABASE_PROJECT_ID",
    "SUPABASE_PROJECT_ID",
  ],
} as const;

export function getPaynocBackendEnv(env: EnvMap = readProcessEnv()) {
  const url = firstDefined(env, PAYNOC_ENV_NAMES.url);
  const anonKey = firstDefined(env, PAYNOC_ENV_NAMES.anonKey);
  const serviceRoleKey = firstDefined(env, PAYNOC_ENV_NAMES.serviceRoleKey);
  const jwtSecret = firstDefined(env, PAYNOC_ENV_NAMES.jwtSecret);
  const projectId = firstDefined(env, PAYNOC_ENV_NAMES.projectId) ?? "paynoc";

  return { url, anonKey, serviceRoleKey, jwtSecret, projectId };
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