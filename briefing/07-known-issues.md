# MonQuest — Known Issues & Debts

Priority-ordered. An external agent should treat these as **real** unless proven otherwise.

## High

1. **Supabase migrations may not be applied.** Runtime guard maps Postgres `42P01` → `SUPABASE_MIGRATIONS_REQUIRED` (503). If this code ships, the DB might be empty. **Manual step:** run `supabase/schema.sql`, then `migrations/002_user_id.sql`, `003_ai_review.sql`, `004_winner.sql` in order.
2. **Privy Monad Testnet not necessarily enabled in the dashboard.** The provider now requests `monadTestnet` — if the Privy app lacks Monad Testnet under *Embedded Wallets → Networks*, embedded-wallet txs silently fail on mainnet. Manual dashboard step.
3. **`next.config.mjs` swallows type/lint errors at build:** `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true`. `npm run build` can be green while `tsc`/`eslint` are red. Always run `npx tsc --noEmit` and `npm run lint` separately.
4. **x402 payment is unverified end-to-end.** The 402→verify loop, `waitForTransactionReceipt` (30s), and error taxonomy are implemented, but no live faucet-funded tx has been confirmed on Monad. The runtime could return `LOW_AMOUNT`/`TX_NOT_FOUND` if block confirmation is slow or the platform wallet address is inhabited.
5. **`PLATFORM_FEE` = "0.001" MON** is hardcoded in both `app/api/bounties/route.ts` (server) and `app/create/page.tsx:11` (client, comment still says "ETH"). If the two drift, the client shows a wrong required amount while the server enforces another. Single-source-of-truth refactor recommended.

## Medium

6. **Winner payout records, doesn't broadcast.** Both verified pay routes (`api/bounties/payout` and the `[id]` page) either confirm a client-side tx or are stubs — no server-side `eth_sendTransaction` from a server key. The bounty flips to `PAID` on trusted client input. Not fraud-safe as shipped.
7. **Payout route kludge** (`PROGRESS.md` A4) has two `if (!isVerified)` paths; one is marked "temporary" and wraps the other. Dead/ambiguous branch — worth a cleanup pass.
8. **No read-path auth.** `GET /api/bounties` returns everything; submissions include `contact`; all RLS policies are `using(true)`. Fine for MVP, not for prod.
9. **Type pollution in `tsconfig.json`:** `path.join(__dirname, "app")`-style include hack breaks editor-fast navigation and `tsc --noEmit` on sub-roots; `create/page.tsx` uses `any` for wallets/balance state (`WalletWithBalance.wallet: any`, `selectedWallet: any`).
10. **Copy debt:** UI still says "Directives" / "Initiatives" / "Fulfillment" in several strings; underlying data is all "bounties". Search `Directive|Initiative|Fulfillment` before polishing copy.
11. **`app/layout.tsx` icon → `/brain.svg`** — no such file; `public/` has no icons (only manifest). Browser may 404 or fall back to favicon.
12. **`app/bounties/[id]/page.tsx` fetches all bounties** then `.find()` client-side (no `/api/bounties/[id]` route). O(n) and chatty on DB.

## Low

13. **`UseLoginPrivy.tsx` is a legacy demo** (mainnet ETH, not imported anywhere). Delete or move to `stories/`.
14. **`Toast` / `Tooltip` (ui/) have no usage** — `Toaster` is mounted in layout, but no component calls `useToast` yet (per PROGRESS bill-of-materials B2).
15. **`app/lib/tokens.ts`** keeps JS constants that mirror `tailwind.config.ts` — a second source of truth that can drift.
16. **`.env.example` header still says "Mon-E-Heist"** (cosmetic; keys inside are correct).
17. **Solana / BTC / web-push / PWA offline** surfaces are functional but untested against real networks (blockchain config defaults to eth-mainnet / solana-devnet).
18. **Stale dev server note:** an old `next-server` on port :3000 can serve HTTP 500 after code changes; fresh `npm run dev` (different port) serves 200. Restart the dev server rather than debugging phantom 500s.
19. **No tests.** No vitest/jest/playwright config in the repo; the smoke checklist (`PROGRESS.md`) is manual.