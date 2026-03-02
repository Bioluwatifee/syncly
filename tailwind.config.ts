import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0b",
        surface: "#111114",
        surface2: "#18181d",
        accent: "#e8c547",
        accent2: "#e85f47",
        spotify: "#1ed760",
        youtube: "#ff4444",
        apple: "#fc3c44",
        muted: "#6b6870",
        "text-primary": "#f0ede8",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        serif: ["Playfair Display", "serif"],
        mono: ["DM Mono", "monospace"],
      },
      borderColor: {
        DEFAULT: "rgba(255,255,255,0.07)",
      },
      animation: {
        pulse: "pulse 2s ease-in-out infinite",
        drift: "drift 12s ease-in-out infinite alternate",
        spin: "spin 8s linear infinite",
        "fade-up": "fadeUp 0.8s ease both",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        drift: {
          from: { transform: "translate(0, 0) scale(1)" },
          to: { transform: "translate(40px, 30px) scale(1.1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
