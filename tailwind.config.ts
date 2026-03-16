import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        oxford: {
          50: "#E7ECF4",
          100: "#CCD8E8",
          200: "#99B0D1",
          300: "#6689BA",
          400: "#3D5D93",
          500: "#2A4268",
          600: "#1B334F",
          700: "#1B263B",
          800: "#141C2C",
          900: "#0E131D"
        },
        deepforest: {
          50: "#E8F2EE",
          100: "#D0E6DD",
          200: "#A2CCBA",
          300: "#73B397",
          400: "#458F6F",
          500: "#2C664F",
          600: "#21503E",
          700: "#1B4332",
          800: "#153225",
          900: "#0E2219"
        },
        slate: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#4A5568",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A"
        },
        surface: {
          50: "#F8FAFC",
          100: "#F1F5F9"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-lora)", "ui-serif", "Georgia", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
