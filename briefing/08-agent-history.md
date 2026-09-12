# MonQuest — Agent History (what has already been done)

Chronological work log (this tree). A fresh agent should not redo any of this.

## 1. Ops / Configuration hardening
- `app/lib/env.ts` — typed env validator (`SERVER_KEYS`/`PUBLIC_KEYS`), `MissingEnvError`; wired into `instrumentation.ts` so `next dev` refuses to boot without required keys; `.env.example` documents every var.
- `app/lib/payout.ts` — Payout info helper: client-safe `getPayoutDetails()` (chain, platform address, fee, currency) + server `getServerPayout()`.
- `app/lib/supabase-guard.ts` — detects known Postgres error (42P01, user missing) and returns `SUPABASE_MIGRATIONS_REQUIRED` (503, non-prod only).
- Supabase — 4 ordered migrations authored and **verified byte-identical** to root `supabase_schema.sql` / `supabase_migration_user_id.sql` / `supabase_migration_ai_review.sql` / `supabase_migration_winner.sql`.
- Bounties route — x402 verification: `paymentRequired(platformFee)` 402 body, retry with backoff (3 attempts, ~500ms→1250ms), `waitForTransactionReceipt` ~30s, error taxonomy `{INVALID_PAYMENT_HASH, TX_NOT_FOUND, BAD_RECIPIENT, LOW_AMOUNT, TX_REVERTED, TX_UNCONFIRMED, RPC_UNAVAILABLE, PAYMENT_REQUIRED, SUPABASE_MIGRATIONS_REQUIRED}`, server-side logs (no secrets). Path guard (prod off) via `isProd` check.
- Privy — `defaultChain`/`supportedChains = monadTestnet` in provider; embedded wallet creation on login.
- Payout route — chainId guard + address-form guard + structured errors `{error, code, hint?}`.
- Cross-cutting: every app API returns `{error, code, hint?}` shape; clients display `error`/`hint`.
- **Manual steps remain** (agent: cannot do): Privy dashboard Monad Testnet toggle; run 4 SQL scripts; faucet funding smoke test. Tracked in PROGRESS.md.

## 2. UI/UX redesign (tokens-first)
- `tailwind.config.ts` — reduced to a single accent green (#16A34A) + 4-step neutral ramp (bg/elevated/overlay) + 3-step fg ramp + line ramps; radii 6/10; `max-w-content` 1120px; Inter sans (`var(--font-sans)`), monospace stack; `.btn*`, `.input`, `.card*`, `.badge`, `.mono`/`.tabular` component classes in `globals.css` `@layer components`.
- `app/globals.css` — dark-only base (`body { @apply bg-bg text-fg; color-scheme: dark; }`), focus-visible rings, `prefers-reduced-motion` guard, CSS-var mirror of tokens.
- `app/lib/tokens.ts` — shared constants.
- `app/components/ui/` — Button, Input, Textarea, Modal (focus-trap/Esc/backdrop/reduced-motion), StatusPill, EmptyState, Skeleton, Tabs,
  **Toast is component-only (no consumer)**.
- Screens migrated to new tokens: Navbar (sticky, `max-w-content`, `border-line bg-bg/70 backdrop-blur`), Footer (Logo + one-liner), Home (hero/stats/features/timeline/faq), Bounties list + detail, Create, Profile. All still referenced **legacy `brand-*`** colors before the MonQuest sweep.
- Verified `npx tsc --noEmit` CLEAN, `npm run lint` EXIT 0, `npm run build` EXIT 0 (note: build ignores TS/lint anyway, see known-issue #3).

## 3. Legacy `brand-*` token sweep (4 screens)
| file | legacy removed | new tokens added |
|---|---|---|
| `app/bounties/page.tsx` | 17 | 17 |
| `app/bounties/[id]/page.tsx` | 17 | 17 |
| `app/create/page.tsx` | 18 | 18 |
| `app/profile/page.tsx` | 14 | 14 |

Replacements: `border-brand-border/10→border-line/70`, `border-brand-border/20→border-line/60`, `border-brand-border/30→border-line/50`, `border-brand-border→border-line`, `bg-brand-paper/80→bg-bg-elevated/60` (and `/50→/60`, `/30→/40`), `bg-brand-paper→bg-bg-elevated`, `bg-brand-border→bg-line`. Verified 0 remaining `brand-` refs in those 4 files, tsc/lint/build still green.

## 4. Rebrand Mon-E-Heist → MonQuest (completed)
- Rewrote brand references across the repo: `PROGRESS.md`, `README.md`, `tailwind.config.ts`, `app/layout.tsx`, `app/components/{CarbonHero,FaqAccordion,Navbar,Footer}.tsx`, `app/globals.css` metadata, `contracts/package.json`, artifacts build-info, `public/manifest.json`.
- New `app/components/Logo.tsx` — SVG MonQuest mark (accent-green "M" + star) + optional wordmark; default export; wired into `Navbar` (left) and `Footer`.
- `public/manifest.json` `background_color` → `#09090B`.
- Verified `grep -ri heist .` (excluding node_modules/.git) → **0 matches**; build/tsc/lint green; install manifest shows `monquest@0.1.0`.

## 5. Current state
- **git:** no commits yet as a "MonQuest" history; ~41 modified + untracked files (see `git status`). Everything above is uncommitted work sitting on top of a (pristine but) empty-history tree.
- **Env:** required vars present and validated; optional `MONAD_RPC_URL`/`GOOGLE_GEMINI_API_KEY` present and gitignored (`.gitignore` line 29 `*.env*`).
- **Smoke status:** localhost smoke test passed on a **fresh dev server** (all routes 200); the stale dev server on :3000 was the source of a phantom HTTP 500 that is now understood. Live-chain smoke (faucet x402, AI-review streaming with images) still pending.
- **Tracker:** `PROGRESS.md` shows 72% overall; verification section C marked done; B2/B3/B4 partially open (Toast/Tooltip usage, create-bounty state machine wiring is 2-step but payment states not fully built, a11y audits, useToast consumers, wrong-network banner, wallets state machine).