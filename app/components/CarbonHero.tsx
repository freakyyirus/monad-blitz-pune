"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Terminal } from "lucide-react";

export default function CarbonHero() {
    return (
        <section className="relative w-full pt-32 pb-24 overflow-hidden min-h-[90vh] flex flex-col justify-center border-b border-brand-border">
            
            {/* Floating Orbs */}
            <div className="absolute top-20 left-1/4 w-72 h-72 bg-accent/30 rounded-full mix-blend-screen filter blur-[100px] opacity-70 animate-pulse" />
            <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-accent-light/20 rounded-full mix-blend-screen filter blur-[120px] opacity-60" />

            <div className="max-w-6xl mx-auto px-6 relative z-10 w-full">
                
                {/* Hero Content */}
                <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-16">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-border bg-white/5 backdrop-blur-md mb-8"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
                        <span className="text-xs font-medium text-primary/80 uppercase tracking-widest">Monad Testnet Live</span>
                    </motion.div>

                    <motion.h1 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tighter text-primary leading-[1.05] mb-6"
                    >
                        The OS for <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent-light">Digital Bounties</span>
                    </motion.h1>

                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-lg sm:text-xl text-primary/60 leading-relaxed max-w-2xl mb-10 font-medium"
                    >
                        A premium marketplace for developers. 
                        AI-validated submissions and instant on-chain settlements built on the Monad network.
                    </motion.p>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center gap-4"
                    >
                        <Link href="/bounties" className="btn-primary group">
                            Explore Marketplace
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link href="/create" className="btn-secondary">
                            Post Directive
                        </Link>
                    </motion.div>
                </div>

                {/* Dashboard Preview Glass Pane */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.5 }}
                    className="w-full max-w-5xl mx-auto rounded-[24px] border border-brand-border bg-[#0f172a]/80 backdrop-blur-3xl shadow-2xl overflow-hidden"
                >
                    {/* Mac-style Window Header */}
                    <div className="flex items-center px-6 py-4 border-b border-white/10 bg-white/5">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400" />
                            <div className="w-3 h-3 rounded-full bg-yellow-400" />
                            <div className="w-3 h-3 rounded-full bg-green-400" />
                        </div>
                        <div className="mx-auto text-sm font-semibold text-white/80 tracking-wide">
                            Platform Dashboard
                        </div>
                        <div className="w-16" /> {/* Spacer for centering */}
                    </div>
                    
                    {/* Dashboard Content Layout */}
                    <div className="flex h-[400px]">
                        {/* Sidebar */}
                        <div className="hidden sm:block w-1/4 border-r border-white/10 p-6 space-y-6 bg-white/[0.02]">
                            <div className="text-lg font-bold text-white flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-gradient-to-br from-accent to-accent-light" />
                                Mon-E-Heist
                            </div>
                            <div className="space-y-2 pt-4">
                                <div className="text-sm font-medium text-white/50 px-3 py-2 hover:text-white cursor-pointer transition-colors">Overview</div>
                                <div className="text-sm font-medium text-white/50 px-3 py-2 hover:text-white cursor-pointer transition-colors">My Directives</div>
                                <div className="text-sm font-medium text-white px-3 py-2 bg-accent/20 border border-accent/30 rounded-lg shadow-[0_0_10px_rgba(91,77,255,0.1)]">Analytics</div>
                                <div className="text-sm font-medium text-white/50 px-3 py-2 hover:text-white cursor-pointer transition-colors">Settings</div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 p-6 sm:p-8 space-y-8 bg-gradient-to-br from-transparent to-accent/5">
                            {/* Top Stats Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                <div className="h-28 rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col justify-between shadow-lg hover:bg-white/10 transition-colors">
                                    <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Total Volume</div>
                                    <div className="text-2xl font-bold text-white tracking-tight">45,231 <span className="text-sm text-white/50 font-medium">MON</span></div>
                                </div>
                                <div className="h-28 rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col justify-between shadow-lg hover:bg-white/10 transition-colors hidden sm:flex">
                                    <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Active Hunters</div>
                                    <div className="text-2xl font-bold text-white tracking-tight">1,204</div>
                                </div>
                                <div className="h-28 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/20 to-accent/5 p-5 flex flex-col justify-between shadow-[0_0_20px_rgba(91,77,255,0.15)] relative overflow-hidden">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-accent rounded-full filter blur-xl opacity-30" />
                                    <div className="text-[10px] font-bold text-white/80 uppercase tracking-widest relative z-10">Pending Rewards</div>
                                    <div className="text-2xl font-bold text-white tracking-tight relative z-10">8,450 <span className="text-sm text-white/70 font-medium">MON</span></div>
                                </div>
                            </div>

                            {/* Main Chart Area */}
                            <div className="h-40 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg flex items-end gap-2 sm:gap-3">
                                {/* Mock bar chart */}
                                {[40, 70, 45, 90, 65, 80, 50, 100, 75, 85, 60, 95].map((h, i) => (
                                    <div key={i} className="w-full bg-accent/50 rounded-t-sm transition-all hover:bg-accent shadow-[0_0_10px_rgba(91,77,255,0.2)]" style={{ height: `${h}%` }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

            </div>
        </section>
    );
}
