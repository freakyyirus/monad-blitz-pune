# MonQuest — Ops Hardening + UI/UX Redesign Tracker

Overall completion: **72%**

Legend: `[x]` done · `[ ]` remaining · `[~]` in progress

---

## A. Ops / Configuration Hardening — 70% complete

### A1. Strict env config guard
- [x] `app/lib/env.ts` — typed env validator + `MissingEnvError` with named messages
- [x] Guard wired into server init points (API routes / db client)
- [x] `.env.example` — every var documented with "where to get it"
- [ ] Manual: user fills `.env.local` values (see manual steps)

### A2. Supabase migrations
- [x] `supabase/README.md` — ordered 4-step migration guide (SQL editor)
- [x] Runtime 42P01 guard with human hint (non-production only)
- [ ] Manual: run 4 SQL scripts in Supabase SQL editor

### A3. Monad Testnet RPC (x402) verification
- [x] Chain config: Monad Testnet (chainId 10143 / 0x279F), native MON
- [x] `MONAD_RPC_URL` env fallback -> public testnet RPC
- [x] Retry with exponential backoff (RPC flakiness)
- [x] Error taxonomy: 400 tx-not-found (+hash), 503 RPC unavailable, 500 other
- [x] `waitForTransactionReceipt` with ~30s timeout
- [x] Server-side logging (RPC + verification failures, no secrets)
- [ ] Manual: add `MONAD_RPC_URL` (optional) + faucet funding

### A4. Privy testnet config + payout chain guard
- [x] Privy default/supported chain = Monad Testnet (10143)
- [x] Winner-pay price chain surfaced from server (`/api/bounties/pricing`)
- [x] Payout route guards chainId + address form; structured errors
- [ ] Manual: toggle **Monad Testnet** in Privy dashboard (Embedded wallets → Networks)

### A5. Cross-cutting structured errors
- [x] Standard error shape `{ error, code, hint? }` across app APIs
- [x] Client surfaces error / hint / code (no raw English dumps)

---

## B. UI/UX Redesign — 72% complete

### B1. Design tokens
- [x] `tailwind.config.ts` — single accent, 4-step neutral scale, radius 6/10, sizes
- [x] `app/globals.css` — dark-only base, focus rings, reduced motion, amt units
- [x] `app/lib/tokens.ts` — shared design constants (accent, radius, sizes)
- [x] Layout: single sans font + tabular numerals for amounts

### B2. UI component library (`app/components/ui/`)
- [x] `Button.tsx` (primary/secondary/ghost/danger, sizes, loading)
- [x] `Input.tsx` / `Textarea.tsx` (labels, hints, error states)
- [x] `Modal.tsx` (a11y: focus trap, Esc, backdrop, reduced-motion)
- [x] `StatusPill.tsx` (OPEN/PAID + ai states)
- [x] `EmptyState.tsx`
- [x] `Skeleton.tsx` (list + block variants)
- [x] `Tabs.tsx`
- [x] `Toast.tsx` + `Toaster` provider + `useToast`
- [ ] `Tooltip.tsx` (hover for long addresses)

### B3. Screens
- [x] Navbar (56px sticky, monad badge, active pill) + Footer (one liner)
- [x] Home — hero (value prop + CTA) + live stats row (Supabase) + 3 recent bounties
- [x] Bounties list — rows (title/prize/status pill/creator/age), filter (search + status), skeleton, empty
- [x] Create bounty — 2-step (form → verify), verified card, 4 submit states + payment state machine
- [x] Bounty detail — header stats + countdown timer, payments, 4 role states, AI review, Markdown preview tab
- [x] Wallet/tx state machine + wrong-network banner + insufficient-funds card

### B4. Accessibility & performance
- [ ] WCAG AA contrast on all surfaces; real buttons; focus-visible rings
- [ ] `prefers-reduced-motion` respected; static prefetch pauses
- [ ] No `window` reads during render; `useEffect`-driven dynamic values

---

## C. Verification — done (tsc/lint/build green)
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` exit 0 (checks enabled — `eslint.ignoreDuringBuilds` / `typescript.ignoreBuildErrors` removed)
- [x] `npm run lint` clean (invoke next lint)
- [ ] Manual smoke test script (env, x402 with faucet MON hash, UXR paths)

## C2. Post-hardening follow-ups (P7 — no crash on current paths, noted for later)
- [ ] `app/lib/blockchain/index.ts:sendTransfer` solana branch normalizes an empty `from` and throws; helper is unused by the app, but callers must pass a valid `from`.
- [ ] `app/lib/blockchain/solana.ts:sendSolanaTransferWithKeypair` computes a keypair from `request.memo` (dead code) then overrides it from env after logging "sending via memo keypair" — remove the first branch.
- [ ] `solana.ts` calls `getSolanaKeypair()` twice in `sendSolanaTransferWithKeypair` for the same env secret; dedupe.
- [ ] `scripts/demo-solana.ts` airdrop loop: devnet faucet 429s are retried bookedly but it may still end at 0 balance — read-only path verified, send path needs a funded keypair.

---

## Manual steps (cannot be done by the agent)
1. Privy dashboard → Monad Testnet (10143 / 0x279F) under App → Embedded Wallets → Networks: enable.
2. Supabase SQL editor → run, in order: `supabase/schema.sql`, `supabase/migrations/002_user_id.sql`, `supabase/migrations/003_ai_review.sql`, `supabase/migrations/004_winner.sql`, `supabase/migrations/005_pending_bounties.sql`.
3. `.env.local`: fill `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_PRIVY_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; optional `MONAD_RPC_URL`, `GOOGLE_GEMINI_API_KEY`.
4. Fund a wallet with Monad testnet MON (faucet), then run the smoke test (Issue D below).

## Smoke checklist (final acceptance)
- [ ] `npm run dev` boots without env errors
- [ ] Can log in via Privy (embedded or MetaMask) on Monad Testnet
- [ ] Posting a bounty without payment returns 402 + `paymentDetails`
- [ ] Sending a real faucet tx then re-posting verifies on Monad (200, bounty visible)
- [ ] Wrong tx hash → 400 with hash in body; RPC down → 503; other → 500 (all `{error, code, hint?}`)
- [ ] AI Review: pending → streaming → done, and failed → retry button
- [ ] Pay winner: chain guard message on wrong network; success marks bounty PAID