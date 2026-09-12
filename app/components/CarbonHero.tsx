"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles, Wallet, Crown } from "lucide-react";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

const marqueeItems = [
  "Monad Testnet",
  "x402 Payments",
  "Privy Wallets",
  "Gemini 2.5 Flash",
  "Supabase",
  "0.001 MON Fees",
  "On-Chain Verification",
  "Wallet-to-Wallet Payouts",
];

export default function CarbonHero() {
  return (
    <section className="relative w-full overflow-hidden border-b border-line">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-pulse-slow absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/25 blur-[120px]" />
        <div className="animate-float absolute right-[8%] top-1/4 hidden h-64 w-64 rounded-full bg-accent/10 blur-[100px] lg:block" />
        <div className="absolute bottom-0 left-[10%] h-56 w-56 rounded-full bg-accent/5 blur-[90px]" />
        <div className="absolute inset-0 bg-grid opacity-60" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-content flex-col items-center justify-center px-4 py-24 sm:px-6">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex w-full flex-col items-center text-center"
        >
          {/* Eyebrow */}
          <motion.div
            variants={item}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-line bg-bg-elevated/70 px-3.5 py-1.5 backdrop-blur-md"
          >
            <span className="flex h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_2px_rgba(22,163,74,0.7)]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
              Live on Monad Testnet · x402
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={item}
            className="max-w-4xl text-4xl font-bold leading-[1.06] tracking-tighter text-fg sm:text-6xl lg:text-7xl"
          >
            Post a bounty.
            <br />
            <span className="text-gradient">Let AI judge the work.</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-fg-muted sm:text-lg"
          >
            MonQuest is a Monad-native marketplace for technical work. Creators pay a
            0.001&nbsp;MON x402 fee to publish, hunters ship markdown + screenshots,
            and Gemini&nbsp;2.5&nbsp;Flash ranks the submissions — then the winner is
            paid wallet-to-wallet, verified on-chain.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={item}
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link href="/create" className="btn-primary group h-10 px-5 text-sm">
              Post a Bounty
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/bounties" className="btn-secondary h-10 px-5 text-sm">
              Explore Marketplace
            </Link>
          </motion.div>

          {/* Micro trust row */}
          <motion.div
            variants={item}
            className="mt-14 grid w-full max-w-3xl gap-3 sm:grid-cols-3"
          >
            {[
              { icon: ShieldCheck, label: "0.001 MON fee" },
              { icon: Sparkles, label: "AI-ranked top-3" },
              { icon: Wallet, label: "Privy wallets" },
            ].map((t) => (
              <div
                key={t.label}
                className="glass flex items-center justify-center gap-2 rounded-[10px] border border-line px-4 py-3"
              >
                <t.icon className="h-4 w-4 shrink-0 text-accent" />
                <span className="text-xs font-semibold text-fg-muted">{t.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Trust marquee */}
      <div className="relative border-t border-line bg-bg-elevated/40 py-4">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-bg to-transparent" />
        <div className="animate-marquee flex w-max items-center gap-10 pl-8">
          {[...marqueeItems, ...marqueeItems].map((itemText, i) => (
            <span
              key={`${itemText}-${i}`}
              className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-fg-faint"
            >
              <Crown className="h-3 w-3 text-accent" />
              {itemText}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}