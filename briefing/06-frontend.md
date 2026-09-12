# MonQuest — Frontend

## Pages (App Router)

| Route | File | What it renders / fetches |
|---|---|---|
| `/` (Home) | `app/page.tsx` | Composes `CarbonHero` + `CarbonFeatures` + `Timeline` + `FaqAccordion` (marketing landing; no data fetch). |
| `/bounties` | `app/bounties/page.tsx` | Bounty registry list. `useEffect` → `fetch("/api/bounties")` (GET all + nested submissions). Local client-side search filter on title/description. Skeleton/empty states. Links each row to `/bounties/[id]`. |
| `/bounties/[id]` | `app/bounties/[id]/page.tsx` | Bounty detail + all bounty UX: header stats (prize, status, creator, created date), markdown description, submissions list (winner badge / AI-preferred badge), AI review modal (`/api/ai-review` streaming), submission form (`/api/submissions`), pay-winner button (`eth_sendTransaction` via wallet provider then `/api/bounties/payout`), `ConnectWalletPrompt` modal. Uses `usePrivy` + `useWallets`. |
| `/create` | `app/create/page.tsx` | 2-step create flow: form (title/description/prize via `MarkdownEditor`) → on submit calls `POST /api/bounties`; if `402` (x402) surfaces the `paymentDetails` and instructs a wallet `eth_sendTransaction` of 0.001 MON to platform wallet, then re-posts with `x-payment-hash`. Reads live wallet balances (`eth_getBalance` per wallet) to auto-select a funded wallet. |
| `/profile` | `app/profile/page.tsx` | Profile: Privy user info, embedded/external wallets, copy address, `exportWallet`, logout, connect wallet modal; tabs "created" / "participated" fetched from `/api/profile?type=…&userId=…&addresses=…`. |
| `/wallets` | `app/wallets/page.tsx` (+ `WalletDashboard.tsx`) | Multi-chain wallet dashboard (EVM `/api/blockchain/balances`, Solana, BTC) — **bonus surface, not part of the bounty flow**. |
| `/~offline` | `app/~offline/page.tsx` | PWA offline fallback page served by the Serwist service worker. |
| `/notification` | `app/notification/route.ts` | Web-push notification endpoint (bonus; uses `web-push`). |

## Components (`app/components/`)

| Component | Description |
|---|---|
| `privy-provider.tsx` | Client wrapper around `@privy-io/react-auth` `PrivyProvider`; app id + optional client id, `defaultChain/supportedChains = monadTestnet`, embedded wallet creation on login. |
| `Navbar.tsx` | Sticky 56px top nav: `Logo`, links Explore/Create/Profile (active-pill styling), "Get Started" CTA. Uses `border-line bg-bg/70 backdrop-blur`. **Does not yet render login state / wallet pill.** |
| `Footer.tsx` | Brand block w/ `Logo`, tagline, Platform/Resources links (GitHub, Monad), copyright + "Powered by x402". |
| `Logo.tsx` | Inline SVG MonQuest mark (accent-green "M" on `#0F0F10` tile, star accent) + wordmark. |
| `MarkdownEditor.tsx` | Textarea ↔ preview toggle w/ `ReactMarkdown`+`remark-gfm`; image upload to Supabase storage `media` bucket via `getSupabaseBrowserClient()`. Exports `MarkdownEditor` and `MarkdownViewer` (render-only). |
| `WalletModal.tsx` | `WalletModal` + `ConnectWalletPrompt` (used by detail/create/profile for submit/pay/connect). |
| `CarbonHero.tsx` / `CarbonFeatures.tsx` / `Timeline.tsx` / `FaqAccordion.tsx` | Landing-page pieces (marketing narrative). |
| `UseLoginPrivy.tsx` | **Legacy demo component** (not routed anywhere). Monorepo-era Privy demo w/ mainnet ETH; hardcoded `mainnet` client. **Do not confuse with the real flow.** |
| `InstallPWA.tsx` / `SendNotification.tsx` | PWA install prompt; web-push sender. Bonus. |
| `solana/SolanaWalletProvider.tsx` | Solana wallet-adapter provider. Bonus. |
| `hooks/useSolanaWallet.ts`, `hooks/useWalletReady.ts` | Client hooks (bonus). |
| `ui/Button.tsx, Input.tsx, Textarea.tsx, Modal.tsx, Skeleton.tsx, StatusPill.tsx, Tabs.tsx, EmptyState.tsx, Toast.tsx, Tooltip.tsx` | Design-system primitives (token-styled: `bg-elevated`, `border-line`, accent focus). `Toaster` is wired in `layout.tsx`. |

## Design approach

- **Dark-only.** `app/globals.css` base sets `body { @apply bg-bg text-fg antialiased; color-scheme: dark; }` and default borders to `border-line`.
- **Tokens** (single source): `tailwind.config.ts` colors — `bg` `#09090B`, `bg-elevated` `#18181B`, `bg-overlay` `#27272A`, `fg` `#FAFAFA`, `fg-muted` `#A1A1AA`, `fg-faint` `#52525B`, `line` `#2A2A2D`, `line-strong` `#3F3F46`, accent `#16A34A` (+ hover `#15803D`, soft `rgba(22,163,74,0.12)`), `success #4ADE80`, `warning #FBBF24`, `danger #F87171`. `app/globals.css` mirrors these as CSS vars `--bg`…`--accent`.
- **Radii:** 6px (sm/default) and 10px (md). **Max content width** `1120px` (`max-w-content`). **Fonts:** `Inter` via `next/font/google` (`--font-sans`); mono = system `ui-monospace`. Heading uses same `--font-sans`.
- **Component classes** in `globals.css @layer components`: `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-ghost`/`.btn-danger` (36px, 6px radius), `.input`/`.textarea`/`.label-utils`, `.card`/`.card-hover` (10px, elevated), `.mono`/`.tabular` (tabular-nums).
- **Icons:** `lucide-react`.
- **Payments wording:** UI copy says "Directives"/"Initiatives"/"Fulfillment" in several places (rebrand copy debt — see `07-known-issues.md`); data everywhere is "bounties". Prize label uses `getPrizeCurrencySymbol()` (→ `MON`).

## Layout wiring

`app/layout.tsx`: `Inter` font, `PrivyProvider` → `Navbar` → `<main>{children}</main>` → `Footer` | `Toaster`. Metadata: title "MonQuest", description "Monad-native bounties, judged by AI…", manifest `/manifest.json`, icon `/brain.svg`, unregister-stale-SW inline script, `themeColor: "#09090B"`.

## Notable quirks

- `bounties/page.tsx` + `[id]` fetch **all** bounties then `.find()` in client — no `/api/bounties/[id]` endpoint exists. O(n) per request.
- Detail page pays winner client-side: `provider.request({method:"eth_sendTransaction"})` then `POST /api/bounties/payout` (payout route only records, doesn't broadcast).
- `connectWallet()` + `useWallets` on Monad Testnet requires the **Privy dashboard** to have Monad Testnet enabled under Embedded Wallets → Networks (manual step).