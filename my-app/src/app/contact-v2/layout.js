import localFont from "next/font/local";

// The Hyperiux typeface, for this page.
const aeonikPro = localFont({
  src: [
    { path: "../../components/ForgingSandDuneConceptV3/fonts/AeonikPro-Light.woff2", weight: "300" },
    { path: "../../components/ForgingSandDuneConceptV3/fonts/AeonikPro-Regular.woff2", weight: "400" },
    { path: "../../components/ForgingSandDuneConceptV3/fonts/AeonikPro-Medium.woff2", weight: "500" },
  ],
  variable: "--font-aeonikpro",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export default function ContactV2Layout({ children }) {
  return <div className={`${aeonikPro.variable} w-full font-[family-name:var(--font-aeonikpro)] antialiased`}>{children}</div>;
}
