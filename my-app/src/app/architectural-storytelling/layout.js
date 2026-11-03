import localFont from "next/font/local";
import "@/components/ArchitecturalStorytelling/architectural.css";

// The site's own typeface (as on hyperiux.com); the technical annotations
// use the app's Geist Mono (root layout).
const aeonikPro = localFont({
  src: [
    { path: "../../../public/assets/fonts/AeonikPro-Light.woff2", weight: "300" },
    { path: "../../../public/assets/fonts/AeonikPro-Regular.woff2", weight: "400" },
    { path: "../../../public/assets/fonts/AeonikPro-Medium.woff2", weight: "500" },
  ],
  variable: "--font-aeonikpro",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export default function ArchitecturalStorytellingLayout({ children }) {
  return <div className={`${aeonikPro.variable} contents`}>{children}</div>;
}
