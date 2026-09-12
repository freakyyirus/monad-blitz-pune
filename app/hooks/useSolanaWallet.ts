"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet as useSolanaWalletAdapter } from "@solana/wallet-adapter-react";
import { sendSolanaTransferViaWallet, getSolanaBalance, getSplTokenBalances } from "@/app/lib/blockchain/solana";
import { getSplTokenList } from "@/app/lib/blockchain/config";
import type { TokenBalance } from "@/app/lib/blockchain/types";

export function useSolanaWallet() {
  const { connected, publicKey, connecting, connect, disconnect, signTransaction, sendTransaction } =
    useSolanaWalletAdapter();
  const address = publicKey?.toBase58() ?? null;

  const [nativeBalance, setNativeBalance] = useState<TokenBalance | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [sendStatus, setSendStatus] = useState("");

  const refreshBalances = useCallback(async () => {
    if (!address) {
      setNativeBalance(null);
      setTokenBalances([]);
      return;
    }
    setLoadingBalances(true);
    try {
      const [native, tokens] = await Promise.all([
        getSolanaBalance(address),
        getSplTokenBalances(address, getSplTokenList()),
      ]);
      setNativeBalance(native);
      setTokenBalances(tokens);
    } catch (error) {
      console.error("refreshSolanaBalances:", error);
    } finally {
      setLoadingBalances(false);
    }
  }, [address]);

  useEffect(() => {
    if (connected && address) {
      refreshBalances();
    }
  }, [connected, address, refreshBalances]);

  const sendSol = useCallback(
    async (to: string, amountSol: string): Promise<{ hash: string } | undefined> => {
      if (!publicKey || !signTransaction) {
        setSendStatus("Connect a Solana wallet first.");
        return undefined;
      }
      setSendStatus("Building transaction...");
      try {
        const { hash } = await sendSolanaTransferViaWallet({
          chain: "solana",
          to,
          amount: amountSol,
          signTransaction,
          from: publicKey.toBase58(),
        });
        setSendStatus(`Confirmed: ${hash}`);
        await refreshBalances();
        return { hash };
      } catch (error: any) {
        const msg = error?.message ?? "Transfer failed";
        setSendStatus(`Error: ${msg}`);
        return undefined;
      }
    },
    [publicKey, signTransaction, refreshBalances],
  );

  return {
    connected,
    connecting,
    connect,
    disconnect,
    address,
    publicKey,
    nativeBalance,
    tokenBalances,
    loadingBalances,
    refreshBalances,
    sendSol,
    sendStatus,
    setSendStatus,
    signTransaction,
    sendTransaction,
  };
}