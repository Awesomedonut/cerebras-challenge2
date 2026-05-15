import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#ffffff",
        parchment: "#f5f5f7",
        action: "#0066cc",
        "focus-blue": "#0071e3",
        headline: "#1d1d1f",
        muted: "#7a7a7a",
        "tile-dark": "#272729",
        border: "#e0e0e0",
        "sky-link": "#2997ff",
      },
      borderRadius: {
        card: "18px",
        pill: "9999px",
      },
      fontFamily: {
        display: [
          "SF Pro Display",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        body: [
          "SF Pro Text",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        "body": ["17px", { lineHeight: "1.47", letterSpacing: "-0.374px" }],
        "body-strong": ["17px", { lineHeight: "1.24", letterSpacing: "-0.374px" }],
        "caption": ["14px", { lineHeight: "1.43", letterSpacing: "-0.224px" }],
        "caption-strong": ["14px", { lineHeight: "1.29", letterSpacing: "-0.224px" }],
        "display-lg": ["40px", { lineHeight: "1.10", letterSpacing: "0px" }],
        "display-md": ["34px", { lineHeight: "1.47", letterSpacing: "-0.374px" }],
        "hero": ["56px", { lineHeight: "1.07", letterSpacing: "-0.28px" }],
        "lead": ["28px", { lineHeight: "1.14", letterSpacing: "0.196px" }],
        "tagline": ["21px", { lineHeight: "1.19", letterSpacing: "0.231px" }],
        "fine-print": ["12px", { lineHeight: "1.0", letterSpacing: "-0.12px" }],
      },
    },
  },
  plugins: [],
};

export default config;
