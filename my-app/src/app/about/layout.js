import localFont from "next/font/local";

// The site's typeface, scoped to this route: Aeonik Pro, as on the
// forging-sand-dune-concept-v3 page.
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

export default function AboutLayout({ children }) {
  return <div className={`${aeonikPro.variable} w-full bg-[#111111] font-[family-name:var(--font-aeonikpro)] text-white`}>{children}</div>;
}
