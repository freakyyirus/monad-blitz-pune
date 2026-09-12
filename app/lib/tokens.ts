/**
 * Design tokens — mirror of the CSS variables in app/globals.css and
 * tailwind.config.ts. Keep in sync. Useful for components that need the
 * values in JS (inline styles, chart colors, etc.).
 */
export const tokens = {
  color: {
    bg: "#09090B",
    bgElevated: "#18181B",
    bgOverlay: "#27272A",
    fg: "#FAFAFA",
    fgMuted: "#A1A1AA",
    fgFaint: "#52525B",
    line: "#2A2A2D",
    lineStrong: "#3F3F46",
    accent: "#16A34A",
    accentHover: "#15803D",
    success: "#4ADE80",
    warning: "#FBBF24",
    danger: "#F87171",
  } as const,

  radius: {
    sm: 6,
    md: 10,
  } as const,

  geometry: {
    content: 1120,
    navHeight: 56,
    btnHeight: 36,
  } as const,

  motion: {
    duration: 150, // ms (base transitions)
    long: 250, // ms (modal, toast)
    ease: "cubic-bezier(0.2, 0, 0, 1)" as const,
  } as const,
};

/** Formats an address for display: `0x1234…abcd`. */
export function truncateAddress(addr: string | undefined, head = 6, tail = 4): string {
  if (!addr) return "";
  return addr.length <= head + tail + 1 ? addr : `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Human, tabular-safe number formatting (never scientific). */
export function formatAmount(value: string | number): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(4).replace(/\.?0+$/, "");
}