"use client";

import Link from "next/link";
import { Brain, Github } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full bg-transparent border-t border-brand-border relative overflow-hidden">
      {/* Subtle bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-accent/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-primary tracking-tight">Mon-E-Heist</span>
            </div>
            <p className="text-xs text-primary/60 max-w-xs leading-relaxed">
              AI-powered bounty platform built on Monad. <br />
              Post tasks, get results, pay instantly.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-16">
            <div>
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.1em] mb-4">Platform</p>
              <div className="flex flex-col gap-2.5">
                <Link href="/bounties" className="text-xs font-medium text-primary/70 hover:text-primary transition-colors">Explore</Link>
                <Link href="/create" className="text-xs font-medium text-primary/70 hover:text-primary transition-colors">Create Bounty</Link>
                <Link href="/profile" className="text-xs font-medium text-primary/70 hover:text-primary transition-colors">Profile</Link>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.1em] mb-4">Resources</p>
              <div className="flex flex-col gap-2.5">
                <Link
                  href="https://github.com/freakyyirus/Mon-E-Heist"
                  target="_blank"
                  className="text-xs font-medium text-primary/70 hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <Github className="h-3 w-3" />
                  GitHub
                </Link>
                <Link href="https://monad.xyz" target="_blank" className="text-xs font-medium text-primary/70 hover:text-primary transition-colors">Monad</Link>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 border-t border-brand-border flex items-center justify-between">
          <p className="text-[10px] font-medium text-primary/40 tracking-tight">© 2025 Mon-E-Heist. Built on Monad.</p>
          <p className="text-[10px] font-medium text-primary/40 tracking-tight">Powered by x402</p>
        </div>
      </div>
    </footer>
  );
}
