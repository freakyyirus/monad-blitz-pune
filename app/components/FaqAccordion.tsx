"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
    {
        question: "What is Mon-E-Heist?",
        answer: "Mon-E-Heist is a premium Web3 platform built on the Monad blockchain that allows creators to post technical bounties and developers to solve them for instant crypto payouts."
    },
    {
        question: "How does the AI review system work?",
        answer: "We integrate Google's Gemini 1.5 Flash to automatically review all code and text submissions. It acts as an unbiased judge, scoring submissions based on requirements and providing detailed feedback instantly."
    },
    {
        question: "Do I need a crypto wallet to participate?",
        answer: "No prior setup is required! We use Privy to automatically provision a secure embedded wallet for you when you sign in with an email or social account. You can also connect an external wallet like MetaMask if you prefer."
    },
    {
        question: "How fast are payouts?",
        answer: "Because we are built on Monad's parallel EVM architecture, settlements are virtually instant. Once a creator approves a submission, the smart contract transfers the MON prize to the winner in under a second."
    }
];

export default function FaqAccordion() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggleFaq = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section className="w-full py-32 border-t border-brand-border/30 relative">
            <div className="max-w-3xl mx-auto px-6 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-primary tracking-tight mb-4">
                        Protocol Questions
                    </h2>
                    <p className="text-primary/60 font-medium text-sm md:text-base">Everything you need to know about the platform.</p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (
                            <div 
                                key={index} 
                                className="border border-brand-border/50 bg-[#0f172a]/30 backdrop-blur-md rounded-2xl overflow-hidden transition-colors hover:border-brand-border"
                            >
                                <button
                                    onClick={() => toggleFaq(index)}
                                    className="w-full flex items-center justify-between p-6 text-left"
                                >
                                    <span className="text-base font-semibold text-primary">{faq.question}</span>
                                    <ChevronDown 
                                        className={`w-5 h-5 text-primary/50 transition-transform duration-300 ${isOpen ? "rotate-180 text-accent" : ""}`} 
                                    />
                                </button>
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                        >
                                            <div className="px-6 pb-6 pt-0 text-sm text-primary/60 leading-relaxed font-medium">
                                                {faq.answer}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
