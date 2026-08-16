import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0b0d11",
          raised: "#12151b",
          overlay: "#171b22",
          border: "#242933",
        },
        accent: {
          DEFAULT: "#6c8cff",
          muted: "#3d4a7a",
        },
        ink: {
          DEFAULT: "#e6e8ec",
          muted: "#9aa1af",
          faint: "#5b6270",
        },
        state: {
          listening: "#3fd6a0",
          thinking: "#f5c451",
          answering: "#6c8cff",
          error: "#f56c6c",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
