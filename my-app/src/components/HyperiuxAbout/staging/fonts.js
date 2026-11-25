import localFont from "next/font/local";

// Aeonik Pro, as hyperiux-staging loads it in its root layout (same four
// weights, same variable name), so `font-aeonik` and the sections' heading /
// body rules resolve to it inside StagingSections only.
export const aeonikPro = localFont({
  src: [
    { path: "./fonts/AeonikPro-Light.woff2", weight: "300" },
    { path: "./fonts/AeonikPro-Regular.woff2", weight: "400" },
    { path: "./fonts/AeonikPro-Medium.woff2", weight: "500" },
    { path: "./fonts/AeonikPro-Bold.woff2", weight: "700" },
  ],
  variable: "--font-aeonikpro",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});
