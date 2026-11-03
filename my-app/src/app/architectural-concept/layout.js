import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";
import "@/components/ArchitecturalConcept/concept.css";
import "@/components/ArchitecturalConcept/chapters/overlays.css";

// The site's own typeface, Aeonik Pro, in its two light weights only (the
// concept uses no bold): Light for display, Regular for text. Labels use
// IBM Plex Mono at regular weight.
const aeonikPro = localFont({
  src: [
    { path: "../../../public/assets/fonts/AeonikPro-Light.woff2", weight: "300" },
    { path: "../../../public/assets/fonts/AeonikPro-Regular.woff2", weight: "400" },
  ],
  variable: "--font-aeonikpro",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-plex-mono", display: "swap" });

export default function ArchitecturalConceptLayout({ children }) {
  return <div className={`${aeonikPro.variable} ${plexMono.variable} contents`}>{children}</div>;
}
