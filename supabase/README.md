# Supabase Setup

This project uses Supabase as its Postgres + Storage backend.

## Prerequisites

- A Supabase project (free tier is fine). Create one at https://supabase.com.
- Collect these values under **Project Settings → API**:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (SERVER-ONLY — never expose in the client)
- Paste them into `.env.local` (see root `.env.example`).

## Run the migrations

Open **SQL Editor** in the Supabase dashboard and run these files **in order**:

| # | File | What it does |
|---|------|--------------|
| 1 | `migrations/001_schema.sql` | Creates `bounties`, `submissions` tables + RLS policies + public `media` storage bucket |
| 2 | `migrations/002_user_id.sql` | Adds `user_id` to `bounties`/`submissions`, optional `users` table |
| 3 | `migrations/003_ai_review.sql` | Adds `is_ai_selected` + `ai_feedback` to `submissions` |
| 4 | `migrations/004_winner.sql` | Adds `winner_submission_id` to `bounties` |

Quick-run all four from this directory:

```bash
# Requires the Supabase CLI and a linked project (supabase login + supabase link)
supabase db push
```

> **Note**: the root-level `supabase_schema.sql`, `supabase_migration_user_id.sql`,
> `supabase_migration_ai_review.sql` and `supabase_migration_winner.sql` are the
> single-file equivalents; the numbered files in `migrations/` are identical.

## Storage

Migration `001` creates a **public** `media` bucket used for submission
images/screenshots. You can also create it manually:

1. **Storage → New bucket** → name `media` → check **Public**.
2. Policy for each operation is created by `001`.