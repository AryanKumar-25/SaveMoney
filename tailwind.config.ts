import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          300: "#FDBA74",
          400: "#FB923C",
          500: "#F97316", // Primary orange
          600: "#EA580C",
          700: "#C2410C",
          800: "#9A3412",
          900: "#7C2D12",
          accent: "#FF9F43",
          primary: "#F7931A",
        },
        navy: {
          900: "#0F172A",
          800: "#1E293B",
          700: "#334155",
        },
        surface: {
          bg: "#F8F9FD",
          card: "#FFFFFF",
          border: "#EDF2F7",
          subtle: "#F1F5F9",
        },
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        card: "0 2px 10px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.04)",
        "card-hover": "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
        glow: "0 4px 14px 0 rgba(247, 147, 26, 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
