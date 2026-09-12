"use client";

import {
  ConnectionProvider as BaseConnectionProvider,
  WalletProvider as BaseWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider as BaseWalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { useMemo, type ReactNode, type FC } from "react";
import { getSolanaRpcUrl } from "@/app/lib/blockchain/config";
import "@solana/wallet-adapter-react-ui/styles.css";

// The wallet-adapter packages are typed against @types/react@19 (pulled in by
// their react-native transitive deps), which conflicts with the app's React 18
// types. Cast them so JSX remains valid — runtime types are unchanged.
const ConnectionProvider = BaseConnectionProvider as unknown as FC<{ endpoint: string; children: ReactNode }>;
const WalletProvider = BaseWalletProvider as unknown as FC<{ wallets: unknown[]; autoConnect?: boolean; children: ReactNode }>;
const WalletModalProvider = BaseWalletModalProvider as unknown as FC<{ children: ReactNode }>;

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => getSolanaRpcUrl(), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()],
    [],
  );
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}