type ErrorLike = {
  message?: unknown;
  error?: unknown;
  error_description?: unknown;
  msg?: unknown;
  code?: unknown;
  status?: unknown;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fromObject(value: ErrorLike): string | null {
  return (
    readString(value.message) ??
    readString(value.error_description) ??
    readString(value.msg) ??
    readString(value.error) ??
    readString(value.code)
  );
}

function fromJsonString(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "{}" || trimmed === "[]") return null;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return fromObject(parsed as ErrorLike) ?? null;
    }
  } catch {
    return trimmed;
  }

  return null;
}

export function getAuthErrorMessage(error: unknown, fallback = "Authentication failed. Please try again.") {
  const raw =
    error instanceof Error
      ? readString(error.message)
      : error && typeof error === "object"
        ? fromObject(error as ErrorLike)
        : readString(error);

  const message = raw ? fromJsonString(raw) : null;
  if (!message) return fallback;

  if (/failed to fetch|networkerror|load failed|fetch failed|backend_unreachable/i.test(message)) {
    return "Cannot reach the backend right now. Please check the backend domain/DNS and try again.";
  }

  if (/invalid login credentials|invalid_credentials/i.test(message)) {
    return "Invalid email or password.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email address before signing in.";
  }

  return message;
}