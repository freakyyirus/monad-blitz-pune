"use client";

import Link from "next/link";
import { Github } from "lucide-react";
import { Logo } from "./Logo";

export default function Footer() {
  return (
    <footer className="relative w-full overflow-hidden border-t border-line">
      <div className="mx-auto flex max-w-content flex-col gap-10 px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Logo width={22} height={22} showWordmark />
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-fg-muted">
              AI-powered bounty platform built on Monad.
              Post tasks, get results, pay instantly.
            </p>
          </div>

          <div className="flex gap-16">
            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-fg-faint">Platform</p>
              <div className="flex flex-col gap-2.5">
                <Link href="/bounties" className="text-xs font-medium text-fg-muted transition-colors hover:text-fg">Explore</Link>
                <Link href="/create" className="text-xs font-medium text-fg-muted transition-colors hover:text-fg">Create Bounty</Link>
                <Link href="/profile" className="text-xs font-medium text-fg-muted transition-colors hover:text-fg">Profile</Link>
              </div>
            </div>
            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-fg-faint">Resources</p>
              <div className="flex flex-col gap-2.5">
                <Link
                  href="https://github.com/freakyyirus/MonQuest"
                  target="_blank"
                  className="flex items-center gap-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
                >
                  <Github className="h-3 w-3" />
                  GitHub
                </Link>
                <Link href="https://monad.xyz" target="_blank" className="text-xs font-medium text-fg-muted transition-colors hover:text-fg">Monad</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-6">
          <p className="text-[10px] font-medium tracking-tight text-fg-faint">© 2025 MonQuest. Built on Monad.</p>
          <p className="text-[10px] font-medium tracking-tight text-fg-faint">Powered by x402</p>
        </div>
      </div>
    </footer>
  );
}