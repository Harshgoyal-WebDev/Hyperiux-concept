import localFont from "next/font/local";

// The concept's typefaces, scoped to this route (the components use
// font-[family-name:var(--font-aeonikpro)] / --font-orbitron).
const aeonikPro = localFont({
  src: [
    { path: "../../components/ForgingVid/fonts/AeonikPro-Light.woff2", weight: "300" },
    { path: "../../components/ForgingVid/fonts/AeonikPro-Regular.woff2", weight: "400" },
    { path: "../../components/ForgingVid/fonts/AeonikPro-Medium.woff2", weight: "500" },
    { path: "../../components/ForgingVid/fonts/AeonikPro-Bold.woff2", weight: "700" },
  ],
  variable: "--font-aeonikpro",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

const orbitron = localFont({
  src: [
    { path: "../../components/ForgingVid/fonts/Orbitron-Regular.woff2", weight: "400" },
    { path: "../../components/ForgingVid/fonts/Orbitron-Medium.woff2", weight: "500" },
  ],
  variable: "--font-orbitron",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export default function ForgingVidLayout({ children }) {
  return (
    <div className={`${aeonikPro.variable} ${orbitron.variable} w-full bg-[#0e0b09] font-[family-name:var(--font-aeonikpro)] text-white`}>
      {children}
    </div>
  );
}
