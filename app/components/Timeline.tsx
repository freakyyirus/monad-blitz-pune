"use client";

import { motion } from "framer-motion";
import { Code, CheckCircle, Cpu, Coins } from "lucide-react";

const steps = [
    {
        title: "Create Directive",
        description: "Post a technical bounty with specific requirements and a MON token prize pool. Locked securely on-chain.",
        icon: Code,
        color: "text-blue-400"
    },
    {
        title: "Hunters Submit",
        description: "Developers worldwide claim the task and submit their solutions directly through the protocol.",
        icon: CheckCircle,
        color: "text-purple-400"
    },
    {
        title: "AI Validation",
        description: "Gemini 1.5 Flash instantly reviews all submissions, verifying code quality and requirement satisfaction.",
        icon: Cpu,
        color: "text-pink-400"
    },
    {
        title: "Instant Settlement",
        description: "The creator approves the best work, triggering a sub-second payout directly to the hunter's wallet via Monad.",
        icon: Coins,
        color: "text-emerald-400"
    }
];

export default function Timeline() {
    return (
        <section className="w-full py-32 border-t border-brand-border/30 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full filter blur-[150px] pointer-events-none" />

            <div className="max-w-4xl mx-auto px-6 relative z-10">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    className="text-center mb-24"
                >
                    <h2 className="text-3xl md:text-5xl font-bold text-primary tracking-tight">
                        A Frictionless <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent-light">Lifecycle.</span>
                    </h2>
                </motion.div>

                <div className="relative border-l border-brand-border/50 md:border-none">
                    {/* Center line for desktop */}
                    <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-brand-border/50 -translate-x-1/2" />

                    {steps.map((step, index) => (
                        <div key={index} className="relative flex flex-col md:flex-row items-center justify-between mb-16 md:mb-24 last:mb-0">
                            
                            {/* Left Side Content (Evens) */}
                            <div className={`w-full md:w-5/12 pl-8 md:pl-0 ${index % 2 === 0 ? "md:text-right md:pr-12" : "md:order-3 md:text-left md:pl-12"} mb-4 md:mb-0`}>
                                <motion.div
                                    initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true, margin: "-100px" }}
                                    transition={{ duration: 0.6, delay: 0.2 }}
                                >
                                    <h3 className="text-xl md:text-2xl font-bold text-primary mb-3 tracking-tight">{step.title}</h3>
                                    <p className="text-sm font-medium text-primary/60 leading-relaxed">{step.description}</p>
                                </motion.div>
                            </div>

                            {/* Node */}
                            <motion.div 
                                initial={{ opacity: 0, scale: 0 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.5, type: "spring" }}
                                className={`absolute left-0 md:left-1/2 -translate-x-[5px] md:-translate-x-1/2 w-10 h-10 md:w-14 md:h-14 rounded-full bg-[#0a0f24] border-2 border-brand-border flex items-center justify-center shadow-[0_0_20px_rgba(91,77,255,0.2)] md:order-2 z-10`}
                            >
                                <step.icon className={`w-5 h-5 md:w-6 md:h-6 ${step.color}`} />
                            </motion.div>

                            {/* Empty space for grid layout */}
                            <div className={`hidden md:block w-5/12 ${index % 2 === 0 ? "order-3" : "order-1"}`} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
