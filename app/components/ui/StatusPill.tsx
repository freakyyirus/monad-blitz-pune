import type { ReactNode } from "react";

const VARIANTS = {
  OPEN: {
    label: "Open",
    dot: "bg-success",
    ring: "border-success/40 bg-success/10 text-success",
  },
  PAID: {
    label: "Paid",
    dot: "bg-fg-faint",
    ring: "border-line bg-bg-overlay text-fg-muted",
  },
  ai_selected: {
    label: "AI Pick",
    dot: "bg-purple-400",
    ring: "border-purple-400/40 bg-purple-400/10 text-purple-300",
  },
  ai_reviewing: {
    label: "Reviewing",
    dot: "bg-accent",
    ring: "border-accent/40 bg-accent/10 text-accent",
  },
} as const;

type Variant = keyof typeof VARIANTS;

interface StatusPillProps {
  variant: Variant;
  className?: string;
}

export function StatusPill({ variant, className = "" }: StatusPillProps) {
  const v = VARIANTS[variant] ?? VARIANTS.OPEN;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums ${v.ring} ${className}`} role="status">
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} aria-hidden />
      {v.label}
    </span>
  );
}