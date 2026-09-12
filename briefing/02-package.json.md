# MonQuest — package.json (verbatim) + resolved dependency versions

## package.json (verbatim, root)

```json
{
  "name": "monquest",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "chain:local": "bash scripts/chain-local.sh",
    "chain:stop": "bash scripts/chain-stop.sh",
    "demo": "tsx scripts/demo.ts",
    "demo:evm": "tsx scripts/demo-evm.ts",
    "demo:solana": "tsx scripts/demo-solana.ts",
    "contracts:deploy": "cd contracts && npm run deploy",
    "contracts:test": "cd contracts && npm test"
  },
  "dependencies": {
    "@bitcoinerlab/secp256k1": "2.0.0",
    "@coral-xyz/anchor": "0.32.1",
    "@google/generative-ai": "^0.24.1",
    "@privy-io/react-auth": "^2.14.2",
    "@serwist/next": "^9.0.15",
    "@solana/spl-token": "0.4.15",
    "@solana/wallet-adapter-backpack": "0.1.14",
    "@solana/wallet-adapter-phantom": "0.9.30",
    "@solana/wallet-adapter-react": "0.15.40",
    "@solana/wallet-adapter-react-ui": "0.9.40",
    "@solana/wallet-adapter-solflare": "0.6.34",
    "@solana/wallet-adapter-wallets": "0.19.39",
    "@solana/web3.js": "1.99.0",
    "@supabase/supabase-js": "^2.87.1",
    "@types/dompurify": "^3.0.5",
    "@vercel/analytics": "^2.0.1",
    "@vercel/speed-insights": "^2.0.0",
    "bitcoinjs-lib": "6.1.8",
    "bs58": "4.0.1",
    "clsx": "^2.1.1",
    "dompurify": "^3.3.1",
    "ecpair": "2.1.0",
    "framer-motion": "^12.23.26",
    "geist": "^1.7.0",
    "isomorphic-dompurify": "^3.0.0",
    "lucide-react": "^0.561.0",
    "next": "^14.2.33",
    "qrcode.react": "^4.2.0",
    "react": "^18",
    "react-dom": "^18",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "serwist": "latest",
    "tailwind-merge": "^3.4.0",
    "viem": "^2.31.2",
    "web-push": "3.6.7"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.19",
    "@types/bs58": "^4.0.4",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/web-push": "^3.6.4",
    "dotenv": "17.4.2",
    "eslint": "^8",
    "eslint-config-next": "^14.2.33",
    "postcss": "^8",
    "serwist": "^9.0.15",
    "tailwindcss": "^3.4.1",
    "tsx": "4.23.13",
    "typescript": "^5"
  }
}
```

## Resolved versions (from package-lock.json)

| Package (node_modules path) | Resolved version |
|---|---|
| next | 14.2.33 |
| react | 18.3.1 |
| react-dom | 18.3.1 |
| typescript | 5.9.3 |
| @privy-io/react-auth | 2.25.0 |
| viem | 2.54.3 |
| wagmi | (not a direct dep; NOT in tree) |
| @supabase/supabase-js | 2.109.0 |
| @supabase/auth-js | 2.109.0 |
| @supabase/storage-js | 2.109.0 |
| @supabase/realtime-js | 2.109.0 |
| @supabase/functions-js | 2.109.0 |
| @supabase/postgrest-js | 2.109.0 |
| @google/generative-ai | 0.24.1 |
| tailwindcss | 3.4.19 |
| lucide-react | 0.561.0 |
| @solana/web3.js | 1.99.0 |

Notes:
- `wagmi` is **not** installed; chain work is done with `viem` + explicit `provider.request` calls (EIP-1193) plus `@privy-io/react-auth`'s `useWallets`.
- `NEXT_PUBLIC_PRIVY_CLIENT_ID` is read (as optional) in `privy-provider.tsx` even though it is not in the `app/lib/env.ts` required list.
- Scripts reference `contracts/` (Hardhat) and `solana-program/` (Anchor) which are shipped in-repo (see `01-file-tree.txt`).