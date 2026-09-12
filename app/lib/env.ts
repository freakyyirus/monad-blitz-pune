/**
 * Strict environment-variable guard.
 *
 * Import this module on the SERVER SIDE ONLY (API routes, middleware,
 * instrumentation.ts).  It validates required env vars at startup and
 * throws a descriptive MissingEnvError when any are missing.
 *
 * Client-safe helpers are exported separately (no secrets).
 */

/* -------------------------------------------------------------------------- */
/*  MissingEnvError — thrown when required env vars are absent                 */
/* -------------------------------------------------------------------------- */

export class MissingEnvError extends Error {
  public readonly missingKeys: string[];
  constructor(keys: string[]) {
    super(
      `Missing required environment variable${keys.length > 1 ? "s" : ""}: ${keys.join(", ")}. ` +
        "Set them in .env.local (see .env.example for details).",
    );
    this.name = "MissingEnvError";
    this.missingKeys = keys;
  }
}

/* -------------------------------------------------------------------------- */
/*  Private: key definitions                                                  */
/* -------------------------------------------------------------------------- */

const SERVER_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_GEMINI_API_KEY",
] as const;

const PUBLIC_KEYS = [
  "NEXT_PUBLIC_PRIVY_APP_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_PLATFORM_WALLET",
] as const;

/**
 * Optional keys that are read at runtime; documented here so we can
 * log helpful warnings if they are absent.
 */
const OPTIONAL_KEYS = [
  "MONAD_RPC_URL", // defaults to public testnet RPC
  "NEXT_PUBLIC_PRIZE_CURRENCY", // defaults to "MON"
  "EVM_RPC_URL",
  "EVM_CHAIN_ID",
  "SOLANA_RPC_URL",
  "BTC_NETWORK",
] as const;

/* -------------------------------------------------------------------------- */
/*  Public: validate all env vars (call once at server startup)                */
/* -------------------------------------------------------------------------- */

let _validated = false;

/**
 * Validates that all required environment variables are set.
 * Throws `MissingEnvError` if any are missing.
 * Subsequent calls are no-ops (idempotent).
 */
export function validateEnv(): void {
  if (_validated) return;

  const missing: string[] = [];

  for (const key of SERVER_KEYS) {
    if (!process.env[key]) missing.push(key);
  }
  for (const key of PUBLIC_KEYS) {
    if (!process.env[key]) missing.push(key);
  }

  if (missing.length > 0) {
    throw new MissingEnvError(missing);
  }

  _validated = true;
}

/* -------------------------------------------------------------------------- */
/*  Typed accessors                                                           */
/* -------------------------------------------------------------------------- */

export function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new MissingEnvError([key]);
  return val;
}

export function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}
