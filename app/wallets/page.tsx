"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const WalletDashboard = dynamic(() => import("./WalletDashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary/30" />
    </div>
  ),
});

export default function WalletsPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-6xl px-6">
        <Link
          href="/bounties"
          className="mb-8 inline-flex items-center text-[10px] font-bold text-primary/40 hover:text-primary uppercase tracking-widest no-underline transition-colors"
        >
          <ArrowLeft className="mr-2 h-3 w-3" />
          Back
        </Link>

        <div className="mb-12">
          <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Multi-Chain Dashboard</p>
          <h1 className="text-4xl font-medium tracking-tighter text-primary">Wallet Balances</h1>
          <p className="mt-2 text-sm font-medium text-primary/50">
            Read balances and send transactions on both EVM and Solana chains.
          </p>
        </div>

        <WalletDashboard />
      </div>
    </div>
  );
}