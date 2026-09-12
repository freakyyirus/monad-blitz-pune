"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSolanaWallet } from "@/app/hooks/useSolanaWallet";
import { getEvmBalance, getEvmTokenBalances, normalizeEvmAddress, sendEvmTransfer, ERC20_ABI } from "@/app/lib/blockchain/evm";
import { getEvmTokenList, getSplTokenList } from "@/app/lib/blockchain/config";
import type { TokenBalance } from "@/app/lib/blockchain/types";
import {
  Wallet,
  Send,
  Coins,
  Bitcoin,
  ArrowDownToLine,
  ArrowUpRight,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { SolanaWalletProvider } from "@/app/components/solana/SolanaWalletProvider";

/* ------------------------------------------------------------------ */
/*  Small helper                                                      */
/* ------------------------------------------------------------------ */

function BalanceRow({ item }: { item: TokenBalance }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-brand-border/10 last:border-0">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-primary/50 uppercase tracking-widest">
          {item.name}
        </span>
        <span className="text-xs font-semibold text-primary">{item.balance} {item.symbol}</span>
      </div>
      {item.contract && (
        <code className="text-[8px] text-primary/30 font-mono truncate ml-4 max-w-[120px]">{item.contract}</code>
      )}
      {item.mint && (
        <code className="text-[8px] text-primary/30 font-mono truncate ml-4 max-w-[120px]">{item.mint}</code>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EVM Card                                                          */
/* ------------------------------------------------------------------ */

function EvmCard() {
  const { authenticated, login, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setRefreshing(true);
    try {
      const addr = normalizeEvmAddress(wallet.address);
      const native = await getEvmBalance(addr);
      const tokens = await getEvmTokenBalances(addr, getEvmTokenList());
      setBalances([native, ...tokens]);
    } catch (error) {
      console.error("evm refresh:", error);
    } finally {
      setRefreshing(false);
    }
  }, [wallet]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSend = useCallback(async () => {
    if (!sendTo || !sendAmount) return;
    setSendStatus("Requesting wallet approval...");
    try {
      const provider = await wallet?.getEthereumProvider();
      const { hash } = await sendEvmTransfer({
        to: sendTo,
        amount: sendAmount,
        provider,
        from: wallet?.address,
      });
      setSendStatus(`Confirmed: ${hash}`);
      setTimeout(() => { refresh(); }, 2000);
    } catch (error: any) {
      setSendStatus(`Error: ${error?.message ?? error}`);
    }
  }, [wallet, sendTo, sendAmount, refresh]);

  return (
    <div className="border border-brand-border bg-[#0f172a]/40 backdrop-blur-xl p-8 rounded-[24px]">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 border border-primary/20 bg-primary/5 text-primary/50 rounded-xl">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">EVM Wallet</p>
            <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest">ETH / ERC-20</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-primary/20 hover:text-primary transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!authenticated ? (
        <div className="text-center py-10">
          <button onClick={login} className="btn-primary px-8 text-[10px] tracking-widest">
            Connect EVM
          </button>
        </div>
      ) : !wallet ? (
        <div className="text-center py-10">
          <button onClick={connectWallet} className="btn-primary px-8 text-[10px] tracking-widest">
            Attach Wallet
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-brand-border bg-white/5 p-3">
            <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest mb-1">Address</p>
            <code className="text-[10px] text-primary font-mono">
              {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
            </code>
          </div>
          <div className="space-y-1 mb-6">
            {balances.map((b, i) => (
              <BalanceRow key={`${b.contract ?? "native"}-${i}`} item={b} />
            ))}
          </div>
          {/* Send */}
          <div className="border-t border-brand-border pt-6 space-y-3">
            <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest">Send ETH</p>
            <input
              type="text"
              placeholder="Recipient address"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              className="w-full border border-brand-border bg-white/5 rounded-xl px-4 py-3 text-[10px] font-semibold text-white placeholder-white/20 focus:border-accent focus:outline-none"
            />
            <input
              type="number"
              step="0.0001"
              placeholder="Amount"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              className="w-full border border-brand-border bg-white/5 rounded-xl px-4 py-3 text-[10px] font-semibold text-white placeholder-white/20 focus:border-accent focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!sendTo || !sendAmount}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-[10px] tracking-widest disabled:opacity-40"
            >
              <ArrowUpRight className="h-3 w-3" /> Send
            </button>
            {sendStatus && (
              <p className="text-[8px] font-bold text-primary/40 text-center break-all">{sendStatus}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Solana Card                                                       */
/* ------------------------------------------------------------------ */

function SolanaCard() {
  const { connected, address, nativeBalance, tokenBalances, loadingBalances, connect, disconnect, sendSol, sendStatus, refreshBalances } =
    useSolanaWallet();
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");

  const handleSend = useCallback(async () => {
    if (!sendTo || !sendAmount) return;
    await sendSol(sendTo, sendAmount);
    setSendTo("");
    setSendAmount("");
  }, [sendTo, sendAmount, sendSol]);

  return (
    <div className="border border-brand-border bg-[#0f172a]/40 backdrop-blur-xl p-8 rounded-[24px]">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 border border-accent/20 bg-accent/5 text-accent/50 rounded-xl">
            <Coins className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Solana Wallet</p>
            <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest">SOL / SPL Tokens</p>
          </div>
        </div>
        <button
          onClick={refreshBalances}
          disabled={loadingBalances}
          className="text-primary/20 hover:text-primary transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loadingBalances ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!connected ? (
        <div className="text-center py-10">
          <button onClick={connect} className="btn-primary px-8 text-[10px] tracking-widest">
            Connect Phantom
          </button>
          <p className="mt-4 text-[8px] font-bold text-primary/20 uppercase tracking-widest">
            Phantom / Solflare / Backpack
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-brand-border bg-white/5 p-3 flex items-center justify-between">
            <div>
              <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest mb-1">Address</p>
              <code className="text-[10px] text-primary font-mono">
                {address?.slice(0, 10)}...{address?.slice(-8)}
              </code>
            </div>
            <button onClick={disconnect} className="text-[8px] font-bold text-accent/40 hover:text-accent uppercase tracking-widest">
              Disconnect
            </button>
          </div>

          <div className="space-y-1 mb-6">
            {nativeBalance && <BalanceRow item={nativeBalance} />}
            {tokenBalances.map((b, i) => (
              <BalanceRow key={`${b.mint}-${i}`} item={b} />
            ))}
          </div>

          <div className="border-t border-brand-border pt-6 space-y-3">
            <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest">Send SOL</p>
            <input
              type="text"
              placeholder="Recipient address"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              className="w-full border border-brand-border bg-white/5 rounded-xl px-4 py-3 text-[10px] font-semibold text-white placeholder-white/20 focus:border-accent focus:outline-none"
            />
            <input
              type="number"
              step="0.0001"
              placeholder="Amount (SOL)"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              className="w-full border border-brand-border bg-white/5 rounded-xl px-4 py-3 text-[10px] font-semibold text-white placeholder-white/20 focus:border-accent focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!sendTo || !sendAmount}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-[10px] tracking-widest disabled:opacity-40"
            >
              <ArrowUpRight className="h-3 w-3" /> Send SOL
            </button>
            {sendStatus && (
              <p className="text-[8px] font-bold text-primary/40 text-center break-all">{sendStatus}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bitcoin Card (read-only — Blockstream via the balances API)        */
/* ------------------------------------------------------------------ */

function BtcCard() {
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookup = useCallback(async (addr: string) => {
    if (!addr) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/blockchain/balances?address=${encodeURIComponent(addr)}&chains=btc`);
      const data = await res.json();
      if (!data.btc) throw new Error(data.errors?.[0] ?? "No BTC balance returned");
      setBalance(data.btc.native);
    } catch (e: any) {
      setBalance(null);
      setError(e?.message ?? "BTC lookup failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="border border-brand-border bg-[#0f172a]/40 backdrop-blur-xl p-8 rounded-[24px]">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 border border-amber-500/20 bg-amber-500/5 text-amber-500/60 rounded-xl">
            <Bitcoin className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Bitcoin Wallet</p>
            <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest">Address Balance (read-only)</p>
          </div>
        </div>
        {balance && (
          <button
            onClick={() => lookup(address)}
            disabled={loading}
            className="text-primary/20 hover:text-primary transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <input
          type="text"
          placeholder="bc1… / tb1… / legacy address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") lookup(address); }}
          className="w-full border border-brand-border bg-white/5 rounded-xl px-4 py-3 text-[10px] font-semibold text-white placeholder-white/20 focus:border-accent focus:outline-none"
        />
        <button
          onClick={() => lookup(address)}
          disabled={!address || loading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-[10px] tracking-widest disabled:opacity-40"
        >
          <ArrowDownToLine className="h-3 w-3" /> {loading ? "Checking…" : "Check Balance"}
        </button>

        {error && (
          <p className="text-[9px] font-bold text-red-400/80 text-center break-all">{error}</p>
        )}
        {balance && (
          <div className="rounded-xl border border-brand-border bg-white/5 p-4">
            <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest mb-1">{balance.name}</p>
            <p className="text-xl font-bold text-primary tracking-tight">
              {balance.balance} <span className="text-xs text-primary/40">{balance.symbol}</span>
            </p>
          </div>
        )}
        <p className="text-[8px] font-bold text-primary/20 uppercase tracking-widest">
          Sends supported server-side via BTC_PRIVATE_KEY_WIF (see README)
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Top-level Dashboard                                                */
/* ------------------------------------------------------------------ */

export default function WalletDashboard() {
  return (
    <SolanaWalletProvider>
      <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        <EvmCard />
        <SolanaCard />
        <BtcCard />
      </div>
    </SolanaWalletProvider>
  );
}