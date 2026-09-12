"use client";

import { motion } from "framer-motion";
import { Brain, Zap, Globe, ShieldCheck, CreditCard, KeyRound } from "lucide-react";

const features = [
  {
    icon: CreditCard,
    title: "x402 Pay-to-Post",
    description:
      "Publishing costs a flat 0.001 MON via the x402 payment protocol. The server returns HTTP 402 with payment details, your wallet pays, and the tx is verified on-chain before the bounty goes live.",
    tag: "Payments",
  },
  {
    icon: Brain,
    title: "AI-Judged Submissions",
    description:
      "One-click audits where Gemini 2.5 Flash streams a ranked top-3 with punchy per-submission feedback — images included in the evaluation.",
    tag: "AI",
  },
  {
    icon: ShieldCheck,
    title: "On-Chain Verification",
    description:
      "Every payment is checked against the chain — recipient, amount, and receipt — for both the 0.001 MON platform fee and the final winner payout.",
    tag: "Trust",
  },
  {
    icon: Zap,
    title: "Wallet-to-Wallet Payouts",
    description:
      "When you pay a winner, the payout tx is verified on Monad before the bounty ever flips to PAID. No escrow, no custody, no middlemen.",
    tag: "Settlement",
  },
  {
    icon: KeyRound,
    title: "Privy Embedded Wallets",
    description:
      "A wallet is created for you on login — defaulting to Monad Testnet — with a wrong-network guard and a one-click chain switch when you need it.",
    tag: "UX",
  },
  {
    icon: Globe,
    title: "Multi-Chain Surfaces",
    description:
      "A bonus wallets page reads EVM, Solana, and Bitcoin balances, backed by a unified balance API and example Hardhat + Anchor programs.",
    tag: "Extras",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function CarbonFeatures() {
  return (
    <section className="relative w-full overflow-hidden py-24 md:py-32">
      <div className="pointer-events-none absolute right-0 top-1/4 h-72 w-72 rounded-full bg-accent/5 blur-[110px]" />

      <div className="relative z-10 mx-auto max-w-content px-4 sm:px-6">
        <div className="mb-14 flex flex-col items-start gap-5 md:mb-20 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Core Capabilities
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl md:text-5xl">
              Engineered for{" "}
              <span className="text-gradient">high-trust payouts</span>.
            </h2>
          </div>
          <p className="max-w-sm text-sm font-medium leading-relaxed text-fg-muted">
            The boring parts hardware — payments, wallet config, verification —
            are automated so you can focus on the work and the review.
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={item}
              className="group relative overflow-hidden rounded-[12px] border border-line bg-bg-elevated p-6 transition-all duration-300 hover:border-accent/40 hover:shadow-pop md:p-7"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="mb-6 inline-flex rounded-[10px] border border-accent/20 bg-accent-soft p-3 transition-transform duration-300 group-hover:-translate-y-0.5">
                <f.icon className="h-5 w-5 text-accent" />
              </div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-bold tracking-tight text-fg">{f.title}</h3>
                <span className="rounded-full border border-line bg-bg-overlay px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-fg-faint">
                  {f.tag}
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed text-fg-muted">{f.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}