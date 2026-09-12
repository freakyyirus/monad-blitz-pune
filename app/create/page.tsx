"use client";

import { useState, useEffect, useRef } from "react";
import {
  usePrivy,
  useWallets,
  type ConnectedWallet,
  type EIP1193Provider,
} from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { parseEther, formatEther } from "viem";
import {
  Loader2,
  Wallet,
  AlertCircle,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { MarkdownEditor } from "@/app/components/MarkdownEditor";
import { useToast } from "@/app/components/ui/Toast";
import Link from "next/link";
import { PLATFORM_FEE, MONAD_NATIVE_SYMBOL, getPrizeCurrencySymbol } from "@/app/lib/blockchain/config";
import { ensureMonadNetwork, WrongNetworkError, MONAD_TX_LINK_PREFIX } from "@/app/lib/payout";

interface WalletWithBalance {
  wallet: ConnectedWallet;
  balance: string;
  hasEnoughFunds: boolean;
  isEmbedded: boolean;
}

/** Payment target returned by the server in its 402 body — single source of truth on the client. */
interface PaymentDetails {
  address: string;
  amount: string;
  currency: string;
  chainId: number;
}

interface PaymentError {
  code?: string;
  message: string;
  hint?: string;
  /** When set, the "retry" button should re-submit the same tx hash. */
  reuseHash?: boolean;
}

type FlowState = "form" | "awaiting-payment" | "verifying" | "success";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isErrorLike(err: unknown): err is { message?: string; code?: number | string; name?: string } {
  return typeof err === "object" && err !== null;
}

export default function CreateBountyPage() {
  const { authenticated, login, connectWallet, ready, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const router = useRouter();
  const { toast } = useToast();
  const CURRENCY = getPrizeCurrencySymbol();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    prize: "",
  });
  const [status, setStatus] = useState("");
  const [flow, setFlow] = useState<FlowState>("form");
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [walletsWithBalance, setWalletsWithBalance] = useState<WalletWithBalance[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<ConnectedWallet | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // x402 payment state
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [txHash, setTxHash] = useState("");
  const [paymentError, setPaymentError] = useState<PaymentError | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState<{ current: number; expected: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const verifyInFlight = useRef(false);

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

      const fundedExternal = walletsData.find((w) => w.hasEnoughFunds && !w.isEmbedded);
      const fundedEmbedded = walletsData.find((w) => w.hasEnoughFunds && w.isEmbedded);

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

  const hasWalletWithFunds = walletsWithBalance.some((w) => w.hasEnoughFunds);

  // ---- x402 state machine -------------------------------------------------

  /** Step 1: POST the bounty without a payment hash → get the 402 + paymentDetails. */
  const requestPaymentDetails = async (wallet: ConnectedWallet) => {
    setPaymentError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          creatorAddress: wallet.address,
          userId: user?.id,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status !== 402) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Unexpected response: ${res.status}`);
      }
      const data = await res.json();
      const pd = data.paymentDetails as PaymentDetails;
      if (!pd?.address || !pd?.amount) {
        throw new Error("Invalid payment details from server: missing recipient address or amount.");
      }
      setPaymentDetails({ ...pd, chainId: Number(pd.chainId) });
      setTxHash("");
      setFlow("awaiting-payment");
    } catch (error) {
      clearTimeout(timeoutId);
      if (isErrorLike(error) && error.name === "AbortError") {
        setPaymentError({ code: "TIMEOUT", message: "Request timed out. Please try again." });
      } else {
        setPaymentError({ message: isErrorLike(error) ? error.message || "Unknown error" : String(error) });
      }
      setFlow("form");
    }
  };

  /**
   * Step 2: POST with the x-payment-hash to verify the on-chain payment.
   * Never hangs: every attempt is bounded by a 30s timeout. TX_UNCONFIRMED is
   * auto-retried once (same hash) after 10s.
   */
  const verifyPayment = async (hash: string, autoRetriesLeft = 1) => {
    if (verifyInFlight.current) return;
    if (!selectedWallet) return;
    verifyInFlight.current = true;
    setPaymentError(null);
    setTxHash(hash);
    setFlow("verifying");
    setStatus("Verifying on Monad…");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-payment-hash": hash,
        },
        body: JSON.stringify({
          ...formData,
          creatorAddress: selectedWallet.address,
          userId: user?.id,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const bounty = await res.json();
        setFlow("success");
        toast("Bounty created", "success");
        router.push(`/bounties/${bounty.id}`);
        return;
      }

      const errorData = await res.json().catch(() => ({}));
      const code: string | undefined = errorData?.code;

      // Auto-retry once for unconfirmed txs with the same hash.
      if (code === "TX_UNCONFIRMED" && autoRetriesLeft > 0) {
        setStatus("Transaction pending — re-checking in 10s…");
        await new Promise((r) => setTimeout(r, 10_000));
        verifyInFlight.current = false;
        await verifyPayment(hash, 0);
        return;
      }

      const mapError = (): PaymentError => {
        switch (code) {
          case "TX_NOT_FOUND":
            return {
              code,
              message: "Transaction not found on Monad yet.",
              hint: "Check the tx hash and wait for confirmation, then retry.",
              reuseHash: true,
            };
          case "TX_UNCONFIRMED":
            return {
              code,
              message: "Transaction is still pending.",
              hint: "Wait a moment, then retry with the same hash.",
              reuseHash: true,
            };
          case "LOW_AMOUNT":
            return {
              code,
              message: `You sent less than the required ${PLATFORM_FEE} ${MONAD_NATIVE_SYMBOL}.`,
              hint: `${errorData?.hint || "Send the difference to the platform wallet and verify again."}`,
              reuseHash: false,
            };
          case "BAD_RECIPIENT":
            return {
              code,
              message: "Payment went to the wrong address.",
              hint: `It must be the platform wallet (${paymentDetails?.address ?? ""}).`,
              reuseHash: false,
            };
          case "TX_REVERTED":
            return {
              code,
              message: "The payment transaction was reverted on-chain.",
              hint: "Send a fresh native transfer and verify again.",
              reuseHash: false,
            };
          case "RPC_UNAVAILABLE":
            return {
              code,
              message: "Monad's RPC is flaky right now.",
              hint: "Try again in a few seconds — your payment is likely fine.",
              reuseHash: true,
            };
          case "INVALID_PAYMENT_HASH":
            return {
              code,
              message: "That doesn't look like a valid transaction hash.",
              hint: "A tx hash is 0x followed by 64 hex characters.",
              reuseHash: false,
            };
          default:
            return {
              code,
              message: errorData?.error || "Could not verify the payment.",
              hint: errorData?.hint || "If you already paid, contact support.",
              reuseHash: true,
            };
        }
      };

      setPaymentError(mapError());
      setFlow("awaiting-payment");
    } catch (error) {
      if (isErrorLike(error) && error.name === "AbortError") {
        setPaymentError({
          code: "TIMEOUT",
          message: "Verification timed out (30s).",
          hint: "Your payment may have gone through. Retry with the same hash.",
          reuseHash: true,
        });
      } else {
        setPaymentError({
          message: isErrorLike(error) ? error.message || "Unknown error" : String(error),
          reuseHash: true,
        });
      }
      setFlow("awaiting-payment");
    } finally {
      verifyInFlight.current = false;
    }
  };

  /** Pay with the connected wallet (eth_sendTransaction after ensuring Monad), then auto-verify. */
  const payWithWallet = async () => {
    if (!selectedWallet || !paymentDetails) return;
    setIsPaying(true);
    setPaymentError(null);
    try {
      const provider = (await selectedWallet.getEthereumProvider()) as EIP1193Provider;
      try {
        await ensureMonadNetwork(provider);
      } catch (err) {
        if (err instanceof WrongNetworkError) {
          setWrongNetwork({ current: err.currentChainId, expected: err.expectedChainId });
          setFlow("awaiting-payment");
          setIsPaying(false);
          return;
        }
        throw err;
      }

      setStatus("Requesting wallet approval…");
      const txParams = {
        from: selectedWallet.address,
        to: paymentDetails.address,
        value: `0x${parseEther(paymentDetails.amount).toString(16)}`,
      };
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [txParams],
      })) as string;

      await verifyPayment(hash);
    } catch (error) {
      let message = isErrorLike(error) ? error.message || "Unknown error" : String(error);
      if (isErrorLike(error) && (error.code === 4001 || message.includes("User rejected"))) {
        message = "Transaction cancelled by the wallet.";
      }
      setPaymentError({ message, reuseHash: false });
    } finally {
      setIsPaying(false);
    }
  };

  /** One-click switch to Monad Testnet from the wrong-network banner. */
  const switchToMonad = async () => {
    if (!selectedWallet) return;
    setStatus("");
    try {
      const provider = (await selectedWallet.getEthereumProvider()) as EIP1193Provider;
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${wrongNetwork?.expected.toString(16) ?? "279f"}` }],
      });
      setWrongNetwork(null);
    } catch (error) {
      setPaymentError({
        message: "Could not switch network automatically.",
        hint: "Open your wallet and switch to Monad Testnet manually, then retry.",
      });
    }
  };

  const copyPaymentAddress = () => {
    if (!paymentDetails) return;
    navigator.clipboard.writeText(paymentDetails.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

    const wallet = selectedWallet ?? wallets[0];
    const selectedWalletData = walletsWithBalance.find((w) => w.wallet.address === wallet.address);
    if (!selectedWalletData?.hasEnoughFunds) {
      setShowWalletSelector(true);
      return;
    }

    await requestPaymentDetails(wallet);
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const hashLooksValid = /^0x[a-fA-F0-9]{64}$/.test(txHash);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-3xl px-6">
        <Link href="/bounties" className="mb-8 inline-flex items-center text-[10px] font-bold text-primary/40 hover:text-primary uppercase tracking-widest no-underline transition-colors">
          <ArrowLeft className="mr-2 h-3 w-3" />
          Registry / Browse Bounties
        </Link>

        <div className="mb-12">
          <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Bounty Creation</p>
          <h1 className="text-4xl font-medium tracking-tighter text-primary">
            Create a New Bounty
          </h1>
          <p className="mt-2 text-sm font-medium text-primary/50">
            Define the task and secure the settlement asset on Monad Testnet.
          </p>
        </div>

        {/* Wrong-network banner (P5) — shown before any tx, never auto-proceeds. */}
        {wrongNetwork && (
          <div className="mb-8 border border-accent/30 bg-accent/10 p-6 rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">
                  Wrong network — chain {wrongNetwork.current}
                </p>
                <p className="text-xs font-medium text-accent/80">
                  Your wallet is on chain {wrongNetwork.current}. Switch to Monad Testnet (chain {wrongNetwork.expected}) to continue.
                </p>
              </div>
              <button
                type="button"
                onClick={switchToMonad}
                className="shrink-0 border border-accent bg-accent/20 px-4 py-2 text-[10px] font-bold text-accent uppercase tracking-widest transition-colors hover:bg-accent hover:text-white"
              >
                Switch to Monad
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="border border-line bg-[#0f172a]/40 backdrop-blur-xl p-10 space-y-10 rounded-[24px]">
            {/* Title Input */}
            <div>
              <label className="block text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-3">
                Bounty Title
              </label>
              <input
                type="text"
                required
                disabled={flow !== "form"}
                className="w-full border border-line bg-white/5 rounded-xl px-4 py-4 text-xs font-semibold text-white placeholder-white/20 transition-all focus:border-accent focus:outline-none disabled:opacity-50"
                placeholder="e.g. Build a parallel execution layer in TypeScript"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            {/* Prize Input */}
            <div>
              <label className="block text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-3">
                Prize Amount ({CURRENCY})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.0001"
                  required
                  disabled={flow !== "form"}
                  className="w-full border border-line bg-white/5 rounded-xl px-4 py-4 text-xs font-semibold text-white placeholder-white/20 transition-all focus:border-accent focus:outline-none disabled:opacity-50"
                  placeholder="0.00"
                  value={formData.prize}
                  onChange={(e) =>
                    setFormData({ ...formData, prize: e.target.value })
                  }
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                  {CURRENCY}
                </div>
              </div>
            </div>

            {/* Description Input */}
            <div>
              <MarkdownEditor
                label="Submission Requirements"
                value={formData.description}
                onChange={(val) => setFormData({ ...formData, description: val })}
                placeholder="Describe technical requirements, acceptance criteria, and documentation standards..."
              />
            </div>
          </div>

          {/* Platform Fee Info */}
          <div className="border border-line bg-[#0f172a]/40 backdrop-blur-xl p-6 flex items-center gap-4 rounded-2xl">
            <div className="p-3 border border-white/10 bg-white/5 text-white/40 rounded-xl">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                Platform Fee
              </p>
              <p className="text-[10px] font-medium text-primary/40 uppercase tracking-tight">
                A non-refundable platform fee of {PLATFORM_FEE} {MONAD_NATIVE_SYMBOL} on Monad Testnet is required to post a bounty.
              </p>
            </div>
          </div>

          {/* x402 payment panel — shown once the server returns paymentDetails */}
          {flow === "awaiting-payment" && paymentDetails && (
            <div className="border border-accent/30 bg-accent/5 backdrop-blur-xl p-8 rounded-[24px]">
              <div className="mb-6 flex items-center gap-3">
                <div className="p-2 border border-accent/20 bg-accent/10 text-accent rounded-xl">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-primary uppercase tracking-widest">
                    Payment Required
                  </h3>
                  <p className="text-[10px] font-medium text-primary/40 uppercase tracking-tight">
                    Send {paymentDetails.amount} {paymentDetails.currency} on Monad Testnet to the platform wallet below.
                  </p>
                </div>
              </div>

              {/* Amount */}
              <div className="mb-4 rounded-xl border border-line bg-white/5 p-4">
                <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest mb-1">Amount</p>
                <p className="text-2xl font-semibold text-primary tracking-tight">
                  {paymentDetails.amount} <span className="text-primary/40">{paymentDetails.currency}</span>
                </p>
              </div>

              {/* Platform address + copy */}
              <div className="mb-6 rounded-xl border border-line bg-white/5 p-4">
                <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest mb-1">Platform Wallet</p>
                <div className="flex items-center justify-between gap-3">
                  <code className="text-xs text-primary font-mono break-all">{paymentDetails.address}</code>
                  <button
                    type="button"
                    onClick={copyPaymentAddress}
                    className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-accent hover:underline uppercase tracking-widest"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Error state (per-error code mapping) */}
              {paymentError && (
                <div className="mb-6 border border-accent/40 bg-accent/10 p-4 rounded-xl">
                  <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">
                    {paymentError.code ? `${paymentError.code.replace(/_/g, " ")}` : "Payment error"}
                  </p>
                  <p className="text-xs font-medium text-primary/80">{paymentError.message}</p>
                  {paymentError.hint && (
                    <p className="mt-1 text-[10px] font-medium text-primary/50">{paymentError.hint}</p>
                  )}
                </div>
              )}

              {/* Pay with wallet button */}
              <button
                type="button"
                onClick={payWithWallet}
                disabled={isPaying || wrongNetwork !== null}
                className="btn-primary w-full py-4 text-xs tracking-[0.2em] font-bold uppercase disabled:opacity-50 mb-4"
              >
                {isPaying ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    {status || "Requesting approval…"}
                  </>
                ) : wrongNetwork ? (
                  "SWITCH TO MONAD TESTNET FIRST"
                ) : (
                  "PAY WITH WALLET"
                )}
              </button>

              {/* Manual hash entry */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  placeholder="Paste your 0x… tx hash"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="w-full border border-line bg-white/5 rounded-xl px-4 py-3 text-[10px] font-semibold text-white placeholder-white/20 focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => verifyPayment(txHash)}
                  disabled={!hashLooksValid}
                  className="border border-line bg-white/5 px-6 py-3 text-[10px] font-bold text-primary uppercase tracking-widest transition-colors hover:bg-white/10 disabled:opacity-40"
                >
                  I&apos;ve sent it
                </button>
              </div>

              {hashLooksValid && (
                <a
                  href={`${MONAD_TX_LINK_PREFIX}${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-primary/40 hover:text-primary uppercase tracking-widest"
                >
                  <ExternalLink className="h-3 w-3" />
                  View on explorer
                </a>
              )}

              <button
                type="button"
                onClick={() => setFlow("form")}
                className="mt-4 text-[10px] font-bold text-primary/30 hover:text-primary uppercase tracking-widest"
              >
                ← Back to form
              </button>
            </div>
          )}

          {/* Wallet selection & submit — only in the form state */}
          {flow === "form" && (
            <>
              {/* Wallet Selection */}
              {authenticated && walletsReady && (
                <div className="border border-line bg-[#0f172a]/40 backdrop-blur-xl p-8 rounded-[24px]">
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
                          className={`flex w-full items-center justify-between border p-4 rounded-xl transition-all ${selectedWallet?.address === w.wallet.address
                            ? "border-accent bg-accent/10"
                            : "border-line bg-white/5 hover:bg-white/10"
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 border rounded-lg ${w.isEmbedded ? "border-white/10 text-white/20" : "border-white/20 text-white/60"}`}>
                              <Wallet className="h-3 w-3" />
                            </div>
                            <div className="text-left">
                              <p className="text-[10px] font-bold text-primary uppercase tracking-tight">
                                {truncateAddress(w.wallet.address)}
                              </p>
                              <p className="text-[8px] font-bold text-primary/30 uppercase tracking-[0.2em]">
                                {w.isEmbedded ? "EMBEDDED WALLET" : w.wallet.walletClientType || "EXTERNAL WALLET"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-[10px] font-bold tracking-tighter ${w.hasEnoughFunds ? "text-primary" : "text-accent"}`}>
                              {parseFloat(w.balance).toFixed(4)} {MONAD_NATIVE_SYMBOL}
                            </p>
                            {!w.hasEnoughFunds && (
                              <p className="text-[8px] font-bold text-accent uppercase tracking-widest">Insufficient</p>
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
                            The selected wallet needs at least {PLATFORM_FEE} {MONAD_NATIVE_SYMBOL} on Monad Testnet to pay the platform fee.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={authenticated && !hasWalletWithFunds}
                className="btn-primary w-full py-5 text-xs tracking-[0.2em] font-bold uppercase disabled:opacity-50"
              >
                {!authenticated ? (
                  "AUTHENTICATE TO POST"
                ) : !hasWalletWithFunds ? (
                  "REPLENISH BALANCE TO CONTINUE"
                ) : (
                  "REGISTER BOUNTY"
                )}
              </button>
            </>
          )}

          {/* Verifying/success states */}
          {flow === "verifying" && (
            <div className="border border-accent/30 bg-accent/5 backdrop-blur-xl p-10 rounded-[24px]">
              <div className="flex items-center gap-4">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-widest">Verifying on Monad…</p>
                  <p className="text-[10px] font-medium text-primary/50 mt-1">
                    {status} Tx {truncateAddress(txHash)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {flow === "success" && (
            <div className="border border-accent-success/30 bg-accent-success/5 backdrop-blur-xl p-10 rounded-[24px]">
              <div className="flex items-center gap-4">
                <Check className="h-5 w-5 text-accent-success" />
                <p className="text-xs font-bold text-success uppercase tracking-widest">
                  Bounty created — redirecting…
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Wallet Connection Modal - Redesigned */}
        {showWalletSelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-elevated backdrop-blur-sm p-6">
            <div className="relative w-full max-w-md border border-line bg-[#0f172a] p-10 shadow-2xl rounded-2xl">
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
                  The current identity lacks sufficient {MONAD_NATIVE_SYMBOL} on Monad Testnet for the platform fee.
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
                    ATTACH WALLET
                  </>
                )}
              </button>

              <p className="text-center text-[8px] font-bold text-primary/30 uppercase tracking-[0.2em]">
                FUND VIA MONAD TESTNET FAUCET
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}