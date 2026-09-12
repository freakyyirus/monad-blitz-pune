"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "./Logo";

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: "/bounties", label: "Explore" },
    { href: "/create", label: "Create" },
    { href: "/profile", label: "Profile" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 w-full items-center justify-center border-b border-line bg-bg/80 backdrop-blur-2xl">
      <nav className="flex w-full max-w-content items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 no-underline" aria-label="MonQuest home">
          <Logo showWordmark />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative text-xs font-semibold tracking-tight transition-colors ${
                isActive(link.href) ? "text-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {isActive(link.href) && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute -inset-x-2 -inset-y-1 -z-10 rounded-[6px] bg-accent-soft"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              {link.label}
            </Link>
          ))}
          <Link href="/create" className="btn-primary group">
            Get Started
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-line bg-bg-elevated text-fg transition-colors hover:border-line-strong md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-x-0 top-16 border-b border-line bg-bg/95 backdrop-blur-2xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-[6px] px-3 py-3 text-sm font-semibold tracking-tight transition-colors ${
                    isActive(link.href)
                      ? "bg-accent-soft text-fg"
                      : "text-fg-muted hover:bg-bg-elevated hover:text-fg"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/create"
                onClick={() => setOpen(false)}
                className="btn-primary mt-2"
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}