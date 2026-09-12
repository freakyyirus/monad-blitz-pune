"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Bounty } from "@/app/lib/db";
import { getPrizeCurrencySymbol } from "@/app/lib/blockchain/config";
import { Loader2, Coins, Search, Plus } from "lucide-react";

const CURRENCY = getPrizeCurrencySymbol();

export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/bounties")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch bounties");
        return res.json();
      })
      .then((data) => {
        setBounties(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filteredBounties = bounties.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-6xl px-6">

        {/* Header */}
        <div className="mb-12 border-b border-line pb-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Public Record</p>
              <h1 className="text-4xl font-medium tracking-tighter text-primary">
                Explore Bounties
              </h1>
              <p className="mt-2 text-sm font-medium text-primary/50">
                A verified marketplace for technical work and on-chain payouts.
              </p>
            </div>
            <Link
              href="/create"
              className="btn-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Post a Bounty
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="mb-12">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/30 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search by ID or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-none border border-line bg-bg-elevated py-4 pl-12 pr-4 text-xs font-semibold text-primary placeholder-primary/30 transition-all focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Bounty Grid */}
        {filteredBounties.length === 0 ? (
          <div className="border border-line bg-bg-elevated flex flex-col items-center justify-center py-24 text-center rounded-[24px]">
            <Search className="h-6 w-6 text-primary/20 mb-4" />
            <h3 className="text-sm font-semibold text-primary">No bounties found</h3>
            <p className="mt-1 text-xs font-medium text-primary/40 tracking-tight">The registry is currently empty for this query.</p>
          </div>
        ) : (
          <div className="grid gap-1 bg-line border border-line">
            {filteredBounties.map((bounty) => (
              <Link
                key={bounty.id}
                href={`/bounties/${bounty.id}`}
                className="bg-bg-elevated p-8 hover:bg-white transition-colors group no-underline"
              >
                <div className="mb-6 flex items-start justify-between">
                  <div className="border border-line bg-white px-3 py-1 text-[10px] font-bold text-primary tracking-widest uppercase">
                    {bounty.prize} {CURRENCY}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-1 w-1 ${bounty.status === "OPEN" ? "bg-accent-success" : "bg-primary/20"}`} />
                    <span className={`text-[10px] font-bold tracking-widest uppercase ${bounty.status === "OPEN" ? "text-accent-success" : "text-primary/30"}`}>
                      {bounty.status}
                    </span>
                  </div>
                </div>

                <h3 className="mb-3 text-lg font-semibold text-primary tracking-tight group-hover:underline underline-offset-4 decoration-primary/20">{bounty.title}</h3>
                <p className="mb-8 line-clamp-2 text-xs font-medium text-primary/50 leading-relaxed">
                  {bounty.description}
                </p>

                <div className="flex items-center justify-between pt-6 border-t border-line/60">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-bold text-primary/30 uppercase tracking-[0.2em]">Originator</span>
                    <span className="font-mono text-[10px] text-primary/60 font-medium tracking-tight">
                      {bounty.creatorAddress.slice(0, 10)}...{bounty.creatorAddress.slice(-8)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className="text-[8px] font-bold text-primary/30 uppercase tracking-[0.2em]">Timestamp</span>
                    <span className="text-[10px] text-primary/60 font-medium tracking-tight">{new Date(bounty.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
