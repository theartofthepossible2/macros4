import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0b",
        card: "#161618",
        cardhi: "#1f1f22",
        line: "#2a2a2e",
        muted: "#8a8a90",
        accent: "#2f9bff",
        good: "#2fd07a",
        bad: "#ff5a5f",
        protein: "#ff5a5f",
        carbs: "#2f9bff",
        fat: "#ffa53a",
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
};
export default config;
