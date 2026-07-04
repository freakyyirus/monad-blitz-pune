"use client";

import { motion } from "framer-motion";
import { Brain, Zap, Globe, Shield } from "lucide-react";

const features = [
    {
        icon: Brain,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "group-hover:border-purple-500/50",
        title: "AI-Powered Verification",
        description: "Gemini AI automatically reviews all submissions, provides feedback, and picks the best work — saving hours of manual review.",
    },
    {
        icon: Zap,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "group-hover:border-blue-500/50",
        title: "Instant Settlement",
        description: "Built on Monad's EVM-compatible blockchain with near-instant finality. Prize payouts happen directly wallet-to-wallet.",
    },
    {
        icon: Globe,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "group-hover:border-emerald-500/50",
        title: "Global Talent Pool",
        description: "Access skilled developers, designers, and creators worldwide. No borders, no middlemen, just results.",
    },
    {
        icon: Shield,
        color: "text-pink-400",
        bg: "bg-pink-500/10",
        border: "group-hover:border-pink-500/50",
        title: "Trustless & Secure",
        description: "x402 payment protocol ensures skin-in-the-game. Every transaction is transparent and verifiable on-chain.",
    },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5 }
    }
};

export default function CarbonFeatures() {
    return (
        <section className="w-full py-32 relative">
            
            {/* Background elements */}
            <div className="absolute top-1/2 left-0 w-full h-[500px] bg-accent/5 -skew-y-6 transform origin-top-left pointer-events-none" />

            <div className="max-w-6xl mx-auto px-6 relative z-10">
                {/* Section Header */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="mb-20 text-center md:text-left"
                >
                    <p className="text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">Core Capabilities</p>
                    <h2 className="text-4xl md:text-5xl font-bold text-primary tracking-tight max-w-2xl leading-tight">
                        Engineered for High-Trust <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50">Digital Transactions.</span>
                    </h2>
                </motion.div>

                {/* Feature Grid */}
                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                    {features.map((feature, i) => (
                        <motion.div
                            key={i}
                            variants={itemVariants}
                            className={`group relative overflow-hidden rounded-[24px] border border-brand-border bg-[#0f172a]/40 p-10 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 ${feature.border}`}
                        >
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            
                            <div className={`mb-8 inline-flex p-3 rounded-2xl ${feature.bg} ring-1 ring-white/10 group-hover:ring-white/20 transition-all`}>
                                <feature.icon className={`h-6 w-6 ${feature.color}`} />
                            </div>
                            <h3 className="text-xl font-bold text-primary mb-4 tracking-tight">{feature.title}</h3>
                            <p className="text-sm font-medium text-primary/60 leading-relaxed max-w-sm">{feature.description}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
