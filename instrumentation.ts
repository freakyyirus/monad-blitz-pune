import { validateEnv } from "@/app/lib/env";

/**
 * Next.js server instrumentation — runs once at server startup.
 * Fails fast when required env vars are missing, instead of
 * surfacing cryptic errors mid-request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      validateEnv();
    } catch (err) {
      console.error(
        `[env] ${(err as Error).message}\n` +
          "See .env.example for the full list of required variables.",
      );
      // Rethrow so the server refuses to boot with a broken config.
      throw err;
    }
  }
}