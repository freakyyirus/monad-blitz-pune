"use client";

import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import Link from "next/link";
import { Loader2, ArrowRight, Trophy, Send, Wallet, Copy, Check, LogOut, Plus } from "lucide-react";
import { WalletModal } from "@/app/components/WalletModal";
import { motion, AnimatePresence } from "framer-motion";

interface Bounty {
  id: string;
  title: string;
  prize: string;
  status: string;
  createdAt: number;
  submissions: any[];
}

export default function ProfilePage() {
  const { user, authenticated, ready, login, connectWallet, exportWallet, logout } = usePrivy();
  const { wallets } = useWallets();
  const [activeTab, setActiveTab] = useState<"created" | "participated">("created");
  const [createdBounties, setCreatedBounties] = useState<Bounty[]>([]);
  const [participatedBounties, setParticipatedBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const getAllUserAddresses = (): string[] => {
    const addresses: Set<string> = new Set();
    if (user?.wallet?.address) {
      addresses.add(user.wallet.address.toLowerCase());
    }
    wallets.forEach(w => {
      if (w.address) {
        addresses.add(w.address.toLowerCase());
      }
    });
    return Array.from(addresses);
  };

  const allAddresses = getAllUserAddresses();
  const embeddedWallet = user?.wallet;
  const externalWallets = wallets.filter(w => w.walletClientType !== "privy");

  useEffect(() => {
    if (!ready || !authenticated) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (user?.id) params.append("userId", user.id);
        if (allAddresses.length > 0) params.append("addresses", allAddresses.join(","));

        const [createdRes, participatedRes] = await Promise.all([
          fetch(`/api/profile?${params.toString()}&type=created`),
          fetch(`/api/profile?${params.toString()}&type=participated`),
        ]);

        if (createdRes.ok) setCreatedBounties(await createdRes.json());
        if (participatedRes.ok) setParticipatedBounties(await participatedRes.json());
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id || allAddresses.length > 0) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [ready, authenticated, user?.id, wallets.length]);

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
        <div className="card rounded-2xl p-10 max-w-md">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
            <Wallet className="h-7 w-7 text-blue-500" />
          </div>
          <h1 className="mb-3 text-2xl font-extrabold text-gray-900">
            Sign in to view profile
          </h1>
          <p className="mb-8 text-gray-500">
            Connect your wallet to manage bounties and submissions.
          </p>
          <button
            onClick={login}
            className="btn-primary text-sm"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-6xl px-6">
        {/* Profile Header */}
        <div className="mb-12 border-b border-brand-border pb-10 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Identity Management</p>
            <h1 className="text-4xl font-medium tracking-tighter text-primary">System Profile</h1>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {/* Embedded Wallet Card */}
              {embeddedWallet && (
                <div className="border border-brand-border bg-white p-5 group transition-colors hover:bg-brand-paper/50">
                  <div className="mb-4 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 border border-primary/10">
                        <Wallet className="h-3 w-3 text-primary/40" />
                      </div>
                      <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Master Identity</span>
                    </div>
                    <button
                      onClick={() => setShowWalletModal(true)}
                      className="text-[8px] font-bold text-accent hover:underline uppercase tracking-widest"
                    >
                      Audit
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="text-[10px] text-primary font-mono font-medium">
                      {embeddedWallet.address.slice(0, 10)}...{embeddedWallet.address.slice(-8)}
                    </code>
                    <button
                      onClick={() => copyAddress(embeddedWallet.address)}
                      className="text-primary/20 hover:text-primary transition-colors"
                    >
                      {copied === embeddedWallet.address ? (
                        <Check className="h-3 w-3 text-accent-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* External Wallets */}
              {externalWallets.map((w) => (
                <div key={w.address} className="border border-brand-border bg-brand-paper/50 p-5 hover:bg-white transition-colors">
                  <div className="mb-4 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 border border-primary/20">
                        <Wallet className="h-3 w-3 text-primary/60" />
                      </div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                        {w.walletClientType || "Remote"} Node
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="text-[10px] text-primary font-mono font-medium">
                      {w.address.slice(0, 10)}...{w.address.slice(-8)}
                    </code>
                    <button
                      onClick={() => copyAddress(w.address)}
                      className="text-primary/20 hover:text-primary transition-colors"
                    >
                      {copied === w.address ? (
                        <Check className="h-3 w-3 text-accent-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={connectWallet}
                className="flex h-[94px] w-[94px] flex-col items-center justify-center gap-2 border border-dashed border-brand-border bg-brand-paper/30 text-[8px] font-bold text-primary/30 uppercase tracking-[0.2em] transition-all hover:bg-white hover:border-primary/20 hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Attach
              </button>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 border border-brand-border bg-white px-5 py-3 text-[10px] font-bold text-primary/40 uppercase tracking-widest transition-all hover:bg-accent/5 hover:text-accent hover:border-accent/20"
          >
            <LogOut className="h-3.5 w-3.5" />
            Deauthorize Session
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-10 border-b border-brand-border overflow-x-auto scrollbar-hide">
          <div className="flex gap-6 md:gap-10 min-w-max">
            <button
              onClick={() => setActiveTab("created")}
              className={`relative pb-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${activeTab === "created"
                ? "text-primary"
                : "text-primary/30 hover:text-primary/60"
                }`}
            >
              Master Directives
              <span className="ml-3 font-mono text-primary/40">
                [{createdBounties.length}]
              </span>
              {activeTab === "created" && (
                <div className="absolute bottom-0 left-0 h-[2px] w-full bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("participated")}
              className={`relative pb-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${activeTab === "participated"
                ? "text-primary"
                : "text-primary/30 hover:text-primary/60"
                }`}
            >
              Fulfillment Log
              <span className="ml-3 font-mono text-primary/40">
                [{participatedBounties.length}]
              </span>
              {activeTab === "participated" && (
                <div className="absolute bottom-0 left-0 h-[2px] w-full bg-primary" />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary/20" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid gap-1 bg-brand-border border border-brand-border"
            >
              {(activeTab === "created" ? createdBounties : participatedBounties).length === 0 ? (
                <div className="bg-brand-paper/50 flex flex-col items-center justify-center py-32 text-center">
                  <div className="mb-6 flex items-center justify-center border border-brand-border bg-white p-5 text-primary/10">
                    {activeTab === "created" ? (
                      <Trophy className="h-8 w-8" />
                    ) : (
                      <Send className="h-8 w-8" />
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-widest">
                    Registry Empty
                  </h3>
                  <p className="mt-2 text-[10px] font-medium text-primary/30 uppercase tracking-tight">
                    {activeTab === "created"
                      ? "No primary directives initialized by this identity."
                      : "No fulfillment records associated with this identity."}
                  </p>
                  {activeTab === "created" && (
                    <Link
                      href="/create"
                      className="mt-10 btn-primary px-8 text-[10px] tracking-widest no-underline"
                    >
                      Initialize Directive
                    </Link>
                  )}
                </div>
              ) : (
                (activeTab === "created" ? createdBounties : participatedBounties).map((bounty) => (
                  <Link
                    key={bounty.id}
                    href={`/bounties/${bounty.id}`}
                    className="group flex items-center justify-between bg-brand-paper p-8 hover:bg-white transition-colors no-underline"
                  >
                    <div>
                      <div className="mb-3 flex items-center gap-4">
                        <h3 className="text-lg font-semibold text-primary tracking-tight group-hover:underline underline-offset-4 decoration-primary/20">
                          {bounty.title}
                        </h3>
                        <span
                          className={`border px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${bounty.status === "OPEN"
                            ? "bg-accent-success/5 border-accent-success/20 text-accent-success"
                            : "bg-brand-paper border-brand-border text-primary/30"
                            }`}
                        >
                          {bounty.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-5 text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                        <span>{new Date(bounty.createdAt).toLocaleDateString()}</span>
                        <span className="text-primary/10">•</span>
                        <span>{bounty.submissions?.length || 0} RECORDS</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 text-right">
                      <div className="space-y-1">
                        <p className="text-[8px] font-bold text-primary/30 uppercase tracking-widest">SETTLEMENT</p>
                        <p className="text-lg font-semibold text-primary tracking-tighter">{bounty.prize} MON</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary/10 group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Wallet Modal */}
      {embeddedWallet && (
        <WalletModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          walletAddress={embeddedWallet.address}
          onExport={exportWallet}
          isEmbedded={true}
        />
      )}
    </div>
  );
}
