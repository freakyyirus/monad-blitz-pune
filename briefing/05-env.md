# MonQuest — Environment Variables Reference

All values are **names only** — no secrets. Source of truth for required keys: `app/lib/env.ts` (validated by `instrumentation.ts` at server startup; server **refuses to boot** if a required var is missing).

## Quick table

| Variable | Client / Server | Read at (file:line) | What breaks if missing |
|---|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | client (public) | `app/components/privy-provider.tsx:13` (required by `env.ts:37`) | PrivyProvider throws; **no login at all**. App won't boot (validated). |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | client (public) | `app/components/privy-provider.tsx:14` (optional, `|| undefined`) | Optional; Privy may fall back to app-id-only COI, but recommended for full functionality. *Not* in env.ts required list. |
| `NEXT_PUBLIC_SUPABASE_URL` | client (public) | `app/lib/supabase-client.ts:4`, `app/lib/db.ts:10` (required by `env.ts:38`) | Every Supabase query throws ("Missing …URL"); app won't boot. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client (public) | `app/lib/supabase-client.ts:5` (required by `env.ts:39`) | Supabase browser client throws; app won't boot. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** (never `NEXT_PUBLIC_`; use-in-`db.ts`) | `app/lib/db.ts:11` (required `env.ts:32`) | All bounty/submission/profile/payout DB calls throw; app won't boot. |
| `GOOGLE_GEMINI_API_KEY` | **server-only** | `app/api/ai-review/route.ts:10,49` (required `env.ts:33`) | AI review returns 500 `GEMINI_NOT_CONFIGURED`; app won't boot (validated). |
| `NEXT_PUBLIC_PLATFORM_WALLET` | client (public) | `app/api/bounties/route.ts:54` (required `env.ts:40`) | Falls back to hardcoded platform wallet; bounty x402 pays wrong/legacy address. Validated. |
| `MONAD_RPC_URL` | **server-only** (optional) | `app/api/bounties/route.ts:11`, `app/lib/blockchain/config.ts:81-82` (`env.ts:48`) | Falls back to public `https://testnet-rpc.monad.xyz`; reliability degrades with public RPC flakiness. |
| `NEXT_PUBLIC_MONAD_RPC_URL` | client (public) (optional) | `app/lib/payout.ts:18` (`env.ts:49` optional list) | Browser falls back to viem `monadTestnet` public RPC. |
| `NEXT_PUBLIC_PRIZE_CURRENCY` | client (public) (optional) | `app/lib/blockchain/config.ts:91` (`env.ts:49`) | Defaults to `"MON"`. |
| `EVM_RPC_URL` | server (optional) | `app/lib/blockchain/config.ts:37` (`env.ts:50`) | Defaults to Ethereum mainnet cloudflare RPC (wallets page bonus surface only). |
| `EVM_CHAIN_ID` | server (optional) | `app/lib/blockchain/config.ts:41` (`env.ts:51`) | Defaults to 1 (Ethereum mainnet). |
| `SOLANA_RPC_URL` | server (optional) | `app/lib/blockchain/config.ts:99` (`env.ts:52`) | Defaults to Solana devnet (wallets page bonus surface). |
| `BTC_NETWORK` | server (optional) | `app/lib/blockchain/btc.ts:30` (`env.ts:53`) | Defaults to `"mainnet"` (Blockstream mainnet API). |
| `EVM_TOKEN_LIST` | server (optional) | `app/lib/blockchain/config.ts:113` | No token rows on wallets EVM surface. Format `addr:sym:dec` comma-separated. |
| `SOLANA_TOKEN_LIST` | server (optional) | `app/lib/blockchain/config.ts:127` | No SPL token rows on wallets surface. Format `mint:sym:dec` comma-separated. |
| `PRIVATE_KEY` / `RPC_URL` / `CHAIN_ID` | **server-only, scripts** (not validated) | `app/lib/blockchain/config.ts:37,41` (fallbacks `RPC_URL`, `CHAIN_ID`); `.env.example` comment | Only used by Hardhat/demo scripts (`scripts/`, `contracts/`). Never ship to client. |

## Required set (validated at boot)

From `app/lib/env.ts:31-41`:

```ts
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
```

`NEXT_PUBLIC_PRIVY_CLIENT_ID` is used by the provider but **is NOT** in `env.ts` — it is optional.

## Boot guard

`instrumentation.ts` (server only) calls `validateEnv()`; on failure it logs and `throw`s, so **`next dev` / `next start` refuse to start** with missing required keys.

## .env.example note

`.env.example` header comment still says **"Mon-E-Heist"** (pre-rebrand leftover) — cosmetic only; keys inside are correct and MonQuest-flavored (Monad section, `#MONAD_RPC_URL` optional, `NEXT_PUBLIC_PRIZE_CURRENCY=MON`).