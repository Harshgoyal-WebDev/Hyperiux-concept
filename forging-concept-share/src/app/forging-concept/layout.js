import localFont from "next/font/local";

// The site's type (as on hyperiux.com): the journey's header and the
// homepage sections below the garden both set in it.
const aeonikPro = localFont({
  src: [
    { path: "../../../public/assets/fonts/AeonikPro-Light.woff2", weight: "300" },
    { path: "../../../public/assets/fonts/AeonikPro-Regular.woff2", weight: "400" },
    { path: "../../../public/assets/fonts/AeonikPro-Medium.woff2", weight: "500" },
    { path: "../../../public/assets/fonts/AeonikPro-Bold.woff2", weight: "700" },
  ],
  variable: "--font-aeonikpro",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

const orbitron = localFont({
  src: [
    { path: "../../../public/assets/fonts/Orbitron-Regular.woff2", weight: "400" },
    { path: "../../../public/assets/fonts/Orbitron-Medium.woff2", weight: "500" },
  ],
  variable: "--font-orbitron",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export default function ForgingConceptLayout({ children }) {
  return <div className={`${aeonikPro.variable} ${orbitron.variable} contents`}>{children}</div>;
}
