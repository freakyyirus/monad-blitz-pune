"use client";

import { useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { parseEther, formatEther } from "viem";
import { Loader2, Wallet, AlertCircle, ArrowLeft } from "lucide-react";
import { MarkdownEditor } from "@/app/components/MarkdownEditor";
import Link from "next/link";

const PLATFORM_FEE = "0.001"; // MON

interface WalletWithBalance {
  wallet: any;
  balance: string;
  hasEnoughFunds: boolean;
  isEmbedded: boolean;
}

export default function CreateBountyPage() {
  const { authenticated, login, connectWallet, ready, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    prize: "",
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [walletsWithBalance, setWalletsWithBalance] = useState<WalletWithBalance[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    async function fetchBalances() {
      if (!walletsReady || wallets.length === 0) return;

      setIsLoadingBalances(true);
      const walletsData: WalletWithBalance[] = [];

      for (const wallet of wallets) {
        try {
          const provider = await wallet.getEthereumProvider();
          const balanceHex = await provider.request({
            method: "eth_getBalance",
            params: [wallet.address, "latest"],
          });
          const balanceWei = BigInt(balanceHex as string);
          const balanceEth = formatEther(balanceWei);
          const requiredWei = parseEther(PLATFORM_FEE);

          const isEmbedded = wallet.walletClientType === "privy";

          walletsData.push({
            wallet,
            balance: balanceEth,
            hasEnoughFunds: balanceWei >= requiredWei,
            isEmbedded,
          });
        } catch (error) {
          console.error(`Error fetching balance for ${wallet.address}:`, error);
          walletsData.push({
            wallet,
            balance: "0",
            hasEnoughFunds: false,
            isEmbedded: wallet.walletClientType === "privy",
          });
        }
      }

      setWalletsWithBalance(walletsData);

      const fundedExternal = walletsData.find(w => w.hasEnoughFunds && !w.isEmbedded);
      const fundedEmbedded = walletsData.find(w => w.hasEnoughFunds && w.isEmbedded);

      if (fundedExternal) {
        setSelectedWallet(fundedExternal.wallet);
      } else if (fundedEmbedded) {
        setSelectedWallet(fundedEmbedded.wallet);
      } else if (walletsData.length > 0) {
        setSelectedWallet(walletsData[0].wallet);
      }

      setIsLoadingBalances(false);
    }

    fetchBalances();
  }, [wallets, walletsReady]);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      await connectWallet();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const hasWalletWithFunds = walletsWithBalance.some(w => w.hasEnoughFunds);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authenticated) {
      login();
      return;
    }

    if (wallets.length === 0) {
      setShowWalletSelector(true);
      return;
    }

    const selectedWalletData = walletsWithBalance.find(w => w.wallet.address === selectedWallet?.address);
    if (!selectedWalletData?.hasEnoughFunds) {
      setShowWalletSelector(true);
      return;
    }

    setLoading(true);
    setStatus("Initiating x402 check...");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          creatorAddress: selectedWallet.address,
          userId: user?.id,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 402) {
        const data = await res.json();
        const { address, amount } = data.paymentDetails;

        setStatus(`x402: Payment Required. Requesting wallet approval...`);

        const provider = await selectedWallet.getEthereumProvider();

        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x279F" }],
          });
        } catch (switchError: any) {
          console.log("Chain switch error (may be ok):", switchError.message);
        }

        if (!address) {
          throw new Error("Invalid payment details from server: missing recipient address.");
        }

        const txParams = {
          from: selectedWallet.address,
          to: address,
          value: `0x${parseEther(amount).toString(16)}`,
        };

        const txHash = await provider.request({
          method: "eth_sendTransaction",
          params: [txParams],
        });

        setStatus("Payment sent! Verifying...");

        await new Promise((r) => setTimeout(r, 2000));

        const res2 = await fetch("/api/bounties", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-payment-hash": txHash as string,
          },
          body: JSON.stringify({
            ...formData,
            creatorAddress: selectedWallet.address,
            userId: user?.id,
          }),
        });

        if (res2.ok) {
          setStatus("Bounty Created Successfully!");
          router.push("/bounties");
        } else {
          const errorData = await res2.json().catch(() => ({}));
          throw new Error(errorData.error || "Verification failed");
        }
      } else if (res.ok) {
        router.push("/bounties");
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Unexpected response: ${res.status}`);
      }
    } catch (error: any) {
      console.error(error);
      if (error.name === "AbortError") {
        setStatus("Error: Request timed out. Please try again.");
      } else if (error.message?.includes("User rejected") || error.code === 4001) {
        setStatus("Transaction cancelled by user.");
      } else {
        setStatus("Error: " + (error.message || "Unknown error"));
      }
    } finally {
      setLoading(false);
    }
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-3xl px-6">
        <Link href="/bounties" className="mb-8 inline-flex items-center text-[10px] font-bold text-primary/40 hover:text-primary uppercase tracking-widest no-underline transition-colors">
          <ArrowLeft className="mr-2 h-3 w-3" />
          Registry / Browse Directives
        </Link>

        <div className="mb-12">
          <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Protocol Initiation</p>
          <h1 className="text-4xl font-medium tracking-tighter text-primary">
            Initialize New Directive
          </h1>
          <p className="mt-2 text-sm font-medium text-primary/50">
            Define fulfillment parameters and secure the settlement asset.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="border border-brand-border bg-white p-10 space-y-10">
            {/* Title Input */}
            <div>
              <label className="block text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-3">
                Directive Identifier (Title)
              </label>
              <input
                type="text"
                required
                className="w-full border border-brand-border bg-brand-paper/30 px-4 py-4 text-xs font-semibold text-primary placeholder-primary/20 transition-all focus:border-primary focus:outline-none"
                placeholder="e.g. Protocol Implementation: Parallel Execution Layer"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            {/* Prize Input */}
            <div>
              <label className="block text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-3">
                Settlement Amount (MON)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.0001"
                  required
                  className="w-full border border-brand-border bg-brand-paper/30 px-4 py-4 text-xs font-semibold text-primary placeholder-primary/20 transition-all focus:border-primary focus:outline-none"
                  placeholder="0.00"
                  value={formData.prize}
                  onChange={(e) =>
                    setFormData({ ...formData, prize: e.target.value })
                  }
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                  MON
                </div>
              </div>
            </div>

            {/* Description Input */}
            <div>
              <MarkdownEditor
                label="Fulfillment Specifications"
                value={formData.description}
                onChange={(val) => setFormData({ ...formData, description: val })}
                placeholder="Describe technical requirements, acceptance criteria, and documentation standards..."
              />
            </div>
          </div>

          {/* Platform Fee Info */}
          <div className="border border-brand-border bg-brand-paper p-6 flex items-center gap-4">
            <div className="p-3 border border-primary/10 bg-white text-primary/40">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                Protocol Fee
              </p>
              <p className="text-[10px] font-medium text-primary/40 uppercase tracking-tight">
                A non-refundable registry fee of {PLATFORM_FEE} MON is required for initialization.
              </p>
            </div>
          </div>

          {/* Wallet Selection */}
          {authenticated && walletsReady && (
            <div className="border border-brand-border bg-white p-8">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">
                  Settlement Source
                </h3>
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest transition-colors"
                >
                  {isConnecting ? "AUTHORIZING..." : "+ ATTACH WALLET"}
                </button>
              </div>

              {isLoadingBalances ? (
                <div className="flex items-center gap-3 text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing ledger balances...
                </div>
              ) : walletsWithBalance.length === 0 ? (
                <div className="text-[10px] font-bold text-accent bg-accent/5 border border-accent/10 p-4 uppercase tracking-widest">
                  <AlertCircle className="mr-2 inline h-3 w-3" />
                  No authorized identities found.
                </div>
              ) : (
                <div className="grid gap-2">
                  {walletsWithBalance.map((w) => (
                    <button
                      key={w.wallet.address}
                      type="button"
                      onClick={() => setSelectedWallet(w.wallet)}
                      className={`flex w-full items-center justify-between border p-4 transition-all ${selectedWallet?.address === w.wallet.address
                        ? "border-primary bg-brand-paper"
                        : "border-brand-border bg-white hover:bg-brand-paper/50"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 border ${w.isEmbedded ? "border-primary/10 text-primary/20" : "border-primary/20 text-primary/60"}`}>
                          <Wallet className="h-3 w-3" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-tight">
                            {truncateAddress(w.wallet.address)}
                          </p>
                          <p className="text-[8px] font-bold text-primary/30 uppercase tracking-[0.2em]">
                            {w.isEmbedded ? "EMBEDDED STORAGE" : w.wallet.walletClientType || "EXTERNAL INTERFACE"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-[10px] font-bold tracking-tighter ${w.hasEnoughFunds ? "text-primary" : "text-accent"}`}>
                          {parseFloat(w.balance).toFixed(4)} MON
                        </p>
                        {!w.hasEnoughFunds && (
                          <p className="text-[8px] font-bold text-accent uppercase tracking-widest">Deficit</p>
                        )}
                      </div>
                    </button>
                  ))}

                  {!hasWalletWithFunds && (
                    <div className="mt-4 border border-accent/20 bg-accent/5 p-4">
                      <p className="text-[10px] font-bold text-accent uppercase tracking-widest">
                        <AlertCircle className="mr-2 inline h-3 w-3" />
                        Insufficient Balance
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-accent/60 uppercase tracking-tight leading-relaxed">
                        Authorized entities require a minimum of {PLATFORM_FEE} MON to initialize directive coverage.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (authenticated && !hasWalletWithFunds)}
            className="btn-primary w-full py-5 text-xs tracking-[0.2em] font-bold uppercase disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                {status}
              </>
            ) : !authenticated ? (
              "AUTHENTICATE TO POST"
            ) : !hasWalletWithFunds ? (
              "REPLENISH BALANCE TO CONTINUE"
            ) : (
              "REGISTER DIRECTIVE"
            )}
          </button>
        </form>

        {/* Wallet Connection Modal - Redesigned */}
        {showWalletSelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-paper/80 backdrop-blur-sm p-6">
            <div className="relative w-full max-w-md border border-brand-border bg-white p-10 shadow-2xl">
              <button
                onClick={() => setShowWalletSelector(false)}
                className="absolute right-6 top-6 text-primary/20 hover:text-primary transition-colors"
                aria-label="Close"
              >
                ✕
              </button>

              <div className="mb-10 text-center">
                <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center border border-accent/20 bg-accent/5">
                  <AlertCircle className="h-5 w-5 text-accent" />
                </div>
                <h2 className="text-lg font-semibold text-primary tracking-tight">
                  Authorization Required
                </h2>
                <p className="mt-3 text-[10px] font-bold text-primary/40 uppercase tracking-widest leading-relaxed">
                  The current identity lacks sufficient MON resources for protocol fee settlement.
                </p>
              </div>

              <button
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="btn-primary w-full py-4 text-xs tracking-[0.15em] mb-4 disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    AUTHORIZING...
                  </>
                ) : (
                  <>
                    <Wallet className="h-3.5 w-3.5" />
                    ATTACH INTERFACE
                  </>
                )}
              </button>

              <p className="text-center text-[8px] font-bold text-primary/30 uppercase tracking-[0.2em]">
                RESOURCE BRIDGE: MONAD PROTOCOL FAUCET
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
