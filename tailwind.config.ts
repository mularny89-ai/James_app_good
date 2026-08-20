import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--brand-primary)",
          dark: "var(--brand-dark)",
          light: "var(--brand-light)",
          bg: "var(--brand-bg)",
        },
        ink: { DEFAULT: "var(--text-primary)", muted: "var(--text-secondary)" },
        line: "var(--border-grey)",
        page: "var(--page-bg)",
        ok: "var(--success)",
        warn: "var(--warning)",
        err: "var(--error)",
        info: "var(--info)",
      },
    },
  },
  plugins: [],
};
export default config;
