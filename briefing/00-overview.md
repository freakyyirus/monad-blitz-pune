# MonQuest — Project Overview

## What the app does

MonQuest is a **decentralized bounty marketplace on the Monad blockchain**. A host ("creator") posts a paid milestone/directive, hunters submit work as markdown documentation with optional images, an **AI judge (Google Gemini)** ranks the top submissions, and the creator pays the winner native **MON on Monad Testnet (chainId 10143)**.

Payment for posting a bounty uses the **x402 protocol** (HTTP 402 + `x-payment-hash` header): the API requires a verified on-chain transaction to the platform wallet before the bounty row is created. All value settlement is on Monad Testnet via the user's wallet (Privy embedded wallet or injected wallet).

## Core user flows

```
login (Privy SSO: email / wallet; embedded wallet on Monad)
  → create bounty (2-step: form → pay 0.001 MON via x402 tx)
  → payment verified on-chain (GET tx, wait receipt, validate recipient + amount)
  → bounty row created (status OPEN)
  → hunters submit markdown work (+contact, +images) /api/submissions
  → creator clicks "Execute AI Audit" → Gemini streams ranking JSON → submissions flagged is_ai_selected + ai_feedback
  → creator pays winner via wallet (eth_sendTransaction on Monad) 
  → /api/bounties/payout records PAID + winner_submission_id
```

Users:
- **Creators / hosts** — post bounties, pay a platform fee, run AI reviews, pay winners.
- **Hunters / contributors** — browse, submit work, receive payouts.
- Users are identified by a **Privy `user.id` (e.g. `did:privy:...`)** plus **wallet addresses**; RLS is open-by-default (dev posture).

## Tech stack

| Layer | Choice | Version (resolved in lockfile) |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.33 |
| Language | TypeScript | 5.9.3 |
| React | React / React DOM | 18.3.1 |
| SSO + embedded wallets | `@privy-io/react-auth` | 2.25.0 |
| Chain lib | `viem` | 2.54.3 |
| Backend DB client | `@supabase/supabase-js` | 2.109.0 (has service-role admin client) |
| AI review | `@google/generative-ai` | 0.24.1 (model `gemini-2.5-flash`) |
| Styling | Tailwind CSS 3.4.19 + `@tailwindcss/typography`; custom `.css` tokens | ^3.4.1 |
| Icons | `lucide-react` | 0.561.0 |
| Markdown | `react-markdown` + `remark-gfm` (render) | ^10.1.0 |
| Framer animations | `framer-motion` | ^12.23.26 |
| PWA / service worker | `@serwist/next` | ^9.0.15 |
| Payments | Native MON transfer (viem), x402 pattern | — |
| Multi-chain bonus surface | Solana (wallet-adapter + @solana/web3.js), Bitcoin (bitcoinjs-lib) | see package.json |
| Smart contracts (bonus) | Hardhat + Solidity (MonQuestToken, SimpleStorage), Anchor (Solana monquest-counter) | contracts/, solana-program/ |

## Key facts an agent must know

- **All app traffic is dark-mode only.** Design tokens are in `app/globals.css` CSS vars + `tailwind.config.ts` (single accent `#16A34A`, 4-step neutral scale, 6px/10px radius).
- **The x402 bounty creation route is the heart**: `app/api/bounties/route.ts` returns `402` with `paymentDetails` when no `x-payment-hash`, then verifies the tx on Monad Testnet with retry/backoff.
- **Chain = Monad Testnet 10143 (0x279F)**, native `MON`, platform fee `0.001 MON` (`PLATFORM_FEE` in `app/lib/blockchain/config.ts`).
- **Two Supabase clients**: `app/lib/supabase-client.ts` (anon, browser) and `app/lib/db.ts` `getSupabaseAdminClient()` (service-role, server-only).
- **Env guard**: `app/lib/env.ts` + `instrumentation.ts` refuses to boot if required keys are missing (see `05-env.md`).
- Contract: submission `submissions.bounty_id` → `bounties.id` must exist (FK guard in db.ts relies on `submissions_bounty_id_fkey`).