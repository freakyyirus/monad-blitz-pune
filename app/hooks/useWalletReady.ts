"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useState, useEffect } from "react";

export function useWalletReady() {
  const { authenticated, ready, user, login, connectWallet } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [isReady, setIsReady] = useState(false);

  // Get the first available wallet (external like MetaMask, or embedded)
  const wallet = wallets[0];
  const hasWallet = !!wallet;
  const walletAddress = wallet?.address || user?.wallet?.address;

  useEffect(() => {
    if (ready && walletsReady) {
      setIsReady(true);
    }
  }, [ready, walletsReady]);

  // Function to ensure user has a wallet ready for transactions
  const ensureWallet = async (): Promise<boolean> => {
    if (!authenticated) {
      login();
      return false;
    }

    if (!hasWallet) {
      // Try to connect an external wallet
      try {
        await connectWallet();
        return true;
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        return false;
      }
    }

    return true;
  };

  // Get the provider for transactions
  const getProvider = async () => {
    if (!wallet) return null;
    return await wallet.getEthereumProvider();
  };

  return {
    isReady,
    authenticated,
    hasWallet,
    wallet,
    walletAddress,
    ensureWallet,
    getProvider,
    login,
    connectWallet,
  };
}
