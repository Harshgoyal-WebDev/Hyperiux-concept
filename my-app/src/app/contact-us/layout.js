import localFont from "next/font/local";

// The contact page's typeface (the Hyperiux one), scoped to this route.
const aeonikPro = localFont({
  src: [
    { path: "../../components/ContactWindow/fonts/AeonikPro-Light.woff2", weight: "300" },
    { path: "../../components/ContactWindow/fonts/AeonikPro-Regular.woff2", weight: "400" },
    { path: "../../components/ContactWindow/fonts/AeonikPro-Medium.woff2", weight: "500" },
  ],
  variable: "--font-aeonikpro",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export default function ContactUsLayout({ children }) {
  return <div className={`${aeonikPro.variable} w-full bg-[#050505] font-[family-name:var(--font-aeonikpro)] text-[#f1f1f1] antialiased`}>{children}</div>;
}
