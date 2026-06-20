import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0F1C", // Premium deep navy-charcoal
        surface: "#12182B",   // Elevated frosted surface
        accent: {
          DEFAULT: "#4F46E5", // Modern Indigo
          glow: "rgba(79, 70, 229, 0.5)"
        },
        gold: {
          DEFAULT: "#F5B041",
          glow: "rgba(245, 176, 65, 0.4)"
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
        }
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
