import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Dark-only app — every value is already tuned for the dark surface,
  // so we never toggle a `dark:` variant.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Dark-only neutral scale — 4 steps (bg / elevated / border / text).
        bg: {
          DEFAULT: "#09090B", // page background
          elevated: "#18181B", // cards, nav
          overlay: "#27272A", // hover, wells
        },
        fg: {
          DEFAULT: "#FAFAFA", // primary text
          muted: "#A1A1AA", // secondary text
          faint: "#52525B", // tertiary text (used small, AA ≥ 4.5:1)
        },
        line: {
          DEFAULT: "#2A2A2D", // default border
          strong: "#3F3F46",
        },
        // Single accent: MonQuest green.
        accent: {
          DEFAULT: "#16A34A", // green-600
          hover: "#15803D", // green-700
          soft: "rgba(22, 163, 74, 0.12)",
        },
        // Semantic — all AA-tested against #09090B.
        success: "#4ADE80",
        warning: "#FBBF24",
        danger: "#F87171",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "6px",
        md: "10px",
      },
      maxWidth: {
        content: "1120px",
      },
      fontSize: {
        stat: ["14px", "1.25"], // tabular figures for stats
      },
      boxShadow: {
        pop: "0 10px 40px -10px rgba(0,0,0,0.5)",
        modal: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "slide-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.8" },
        },
        "shine": {
          "0%": { transform: "translateX(-150%) skewX(-15deg)" },
          "100%": { transform: "translateX(250%) skewX(-15deg)" },
        },
      },
      animation: {
        "fade-in": "fade-in 250ms ease-out both",
        "slide-up": "slide-up 250ms ease-out both",
        marquee: "marquee 34s linear infinite",
        float: "float 7s ease-in-out infinite",
        "pulse-slow": "pulse-slow 5.5s ease-in-out infinite",
        shine: "shine 3.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
