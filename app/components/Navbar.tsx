"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/bounties", label: "Explore" },
    { href: "/create", label: "Create" },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-16 w-full items-center justify-center bg-[#070B1A]/70 backdrop-blur-2xl border-b border-brand-border transition-all duration-300">
      <nav className="flex w-full max-w-6xl items-center justify-between px-6">

        <Link href="/" className="flex items-center gap-2 no-underline">
          <Brain className="h-5 w-5 text-primary" />
          <span className="font-semibold text-base text-primary tracking-tight">Mon-E-Heist</span>
        </Link>

        <div className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-xs font-semibold tracking-tight transition-colors ${pathname === link.href
                ? "text-primary"
                : "text-primary/60 hover:text-primary"
                }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/create"
            className="btn-primary"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </div>
  );
}
