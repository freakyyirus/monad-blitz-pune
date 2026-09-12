# MonQuest — Database (Supabase / Postgres)

Supabase Postgres. The root `.sql` files and their copies in `supabase/migrations/` are byte-identical (verified). **Run order matters (FK dependencies):**

1. `supabase/migrations/001_schema.sql` (= `supabase_schema.sql`)
2. `supabase/migrations/002_user_id.sql` (= `supabase_migration_user_id.sql`)
3. `supabase/migrations/003_ai_review.sql` (= `supabase_migration_ai_review.sql`)
4. `supabase/migrations/004_winner.sql` (= `supabase_migration_winner.sql`)

The app's runtime guard maps Postgres `42P01` ("relation does not exist") to `SUPABASE_MIGRATIONS_REQUIRED` — meaning tables are missing and these migrations haven't run yet (`app/lib/supabase-guard.ts`).

---

## Migration 001 — schema (`supabase_schema.sql` / `supabase/migrations/001_schema.sql`)

```sql
-- Create bounties table
create table bounties (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  prize text not null,
  creator_address text not null,
  status text check (status in ('OPEN', 'PAID')) default 'OPEN',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create submissions table
create table submissions (
  id uuid default gen_random_uuid() primary key,
  bounty_id uuid references bounties(id) on delete cascade not null,
  hunter_address text not null,
  content text not null,
  contact text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table bounties enable row level security;
alter table submissions enable row level security;

-- Create policies (for development, we'll allow public access, but in prod you'd want stricter rules)
create policy "Public bounties are viewable by everyone"
  on bounties for select
  using ( true );

create policy "Anyone can create bounties"
  on bounties for insert
  with check ( true );

create policy "Creators can update their bounties"
  on bounties for update
  using ( true ); -- Ideally check creator_address matches auth.uid() if using Supabase Auth, but we are using Privy/Wallet address

create policy "Public submissions are viewable by everyone"
  on submissions for select
  using ( true );

create policy "Anyone can submit"
  on submissions for insert
  with check ( true );

-- Storage Setup (Run this in Supabase SQL Editor)

-- 1. Create the 'media' bucket
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- 2. Create policies for the 'media' bucket
-- Note: We skip enabling RLS as it is enabled by default on storage.objects

drop policy if exists "Public Access to Media" on storage.objects;
create policy "Public Access to Media"
  on storage.objects for select
  using ( bucket_id = 'media' );

drop policy if exists "Anyone can upload Media" on storage.objects;
create policy "Anyone can upload Media"
  on storage.objects for insert
  with check ( bucket_id = 'media' );
```

### Migration 002 — user_id columns (`supabase_migration_user_id.sql` / `supabase/migrations/002_user_id.sql`)

```sql
-- Migration: Add user_id column to bounties and submissions tables
-- This allows tracking users across multiple wallets (embedded + MetaMask)

-- Add user_id to bounties
ALTER TABLE bounties ADD COLUMN IF NOT EXISTS user_id text;

-- Add user_id to submissions  
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_id text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bounties_user_id ON bounties(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);

-- Optionally: Create a users table to store user wallet mappings
-- (This is optional but useful for future features)
CREATE TABLE IF NOT EXISTS users (
  id text primary key, -- Privy user ID (e.g., "did:privy:...")
  wallet_addresses text[] default '{}', -- Array of all wallet addresses
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Users viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can be created" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can be updated" ON users FOR UPDATE USING (true);
```

### Migration 003 — AI review columns (`supabase_migration_ai_review.sql` / `supabase/migrations/003_ai_review.sql`)

```sql
-- Add AI review columns to submissions table
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS is_ai_selected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
```

### Migration 004 — winner reference (`supabase_migration_winner.sql` / `supabase/migrations/004_winner.sql`)

```sql
-- Add winner_submission_id to bounties table
ALTER TABLE bounties 
ADD COLUMN IF NOT EXISTS winner_submission_id uuid REFERENCES submissions(id);
```

---

## Default table/column reference

### `bounties`
| column | type | notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| title | text NOT NULL | |
| description | text NOT NULL | markdown, AI-judged |
| prize | text NOT NULL | human-readable amount, e.g. "0.5" (native MON) |
| creator_address | text NOT NULL | lowercased in app before insert |
| status | text | CHECK in ('OPEN','PAID'), default 'OPEN' |
| created_at | timestamptz | default utc now |
| user_id | text | added by migration 002; Privy `did:privy:...` |
| winner_submission_id | uuid REFERENCES submissions(id) | added by migration 004 |

FK used by app: `submissions_bounty_id_fkey` (bounties → submissions), referenced explicitly in select strings `submissions!submissions_bounty_id_fkey(*)`.

### `submissions`
| column | type | notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| bounty_id | uuid NOT NULL FK → bounties(id) ON DELETE CASCADE | |
| hunter_address | text NOT NULL | lowercased in app before insert |
| content | text NOT NULL | markdown w/ optional `![alt](url)` images |
| contact | text | optional email/PGP/handle |
| created_at | timestamptz | default utc now |
| user_id | text | added by migration 002 |
| is_ai_selected | boolean default false | added by migration 003 |
| ai_feedback | text | added by migration 003 |

### `users` (optional, migration 002)
| column | type | notes |
|---|---|---|
| id | text PK | Privy user id (`did:privy:...`) |
| wallet_addresses | text[] default '{}' | |
| created_at / updated_at | timestamptz | |

### `storage.objects` (migration 001)
- creates public `media` bucket; public select + insert policies.

---

## App query shape

`db.getBounties`/`getBounty` fetch nested submissions via:

```ts
.from("bounties")
.select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
```

If migration 001 hasn't created the tables/FK, the Postgres server returns code `42P01` and the app answers `503 { error, code: "SUPABASE_MIGRATIONS_REQUIRED", hint }`.