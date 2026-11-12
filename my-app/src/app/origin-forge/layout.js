import localFont from "next/font/local";
import "@/components/OriginForge/origin-forge.css";

// Aeonik Pro, the Hyperiux brand face (public/assets/fonts), scoped to this
// route.
const aeonik = localFont({
  src: [
    { path: "../../../public/assets/fonts/AeonikPro-Light.woff2", weight: "300" },
    { path: "../../../public/assets/fonts/AeonikPro-Regular.woff2", weight: "400" },
    { path: "../../../public/assets/fonts/AeonikPro-Medium.woff2", weight: "500" },
    { path: "../../../public/assets/fonts/AeonikPro-Bold.woff2", weight: "700" },
  ],
  variable: "--font-aeonikpro",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

export default function OriginForgeLayout({ children }) {
  return (
    <div data-of-root className={`${aeonik.variable} of-root`}>
      {children}
    </div>
  );
}
