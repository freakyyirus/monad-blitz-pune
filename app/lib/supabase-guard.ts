/**
 * Structured Supabase error handling.
 *
 * Supabase/Postgres errors can be opaque ("relation does not exist"). We
 * decorate the underlying error with a stable `code` and a human `hint` so API
 * routes can return a consistent { error, code, hint? } shape.
 *
 * Error codes surfaced:
 *  - "SUPABASE_MIGRATIONS_REQUIRED" (Postgres 42P01: missing table) — hint
 *    tells the dev to run the SQL scripts in supabase/README.md.
 *  - "SUPABASE_CONNECTION" — network / auth failure.
 *  - "SUPABASE_QUERY" — everything else. hint preserved when present.
 */

const IS_PROD = process.env.NODE_ENV === "production";

interface Decorated {
  code: string;
  hint?: string;
}

function isPostgresRelationError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42P01"
  );
}

/** Decorates a supabase error with { code, hint }. Returns the same error ref. */
export function decorateSupabaseError(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return error;
  const target = error as Record<string, unknown> & Decorated;

  if (isPostgresRelationError(error)) {
    target.code = "SUPABASE_MIGRATIONS_REQUIRED";
    // Full hint only in non-production; prod surfaces the short message.
    target.hint = IS_PROD
      ? "Database not configured."
      : "A required database table is missing. Run the migration scripts in supabase/README.md (SQL editor).";
    return error;
  }

  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    target.code = (error as { code: string }).code;
    return error;
  }

  // Distinguish auth/connection failures (invalid project URL, revoked key…)
  const message = error instanceof Error ? error.message : String(error);
  const connectionish =
    /fetch failed|ECONNREFUSED|network|invalid api key|Invalid API key|424/i.test(message);
  target.code = connectionish ? "SUPABASE_CONNECTION" : "SUPABASE_QUERY";
  target.hint = connectionish
    ? "Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (project Settings → API)."
    : undefined;

  return error;
}