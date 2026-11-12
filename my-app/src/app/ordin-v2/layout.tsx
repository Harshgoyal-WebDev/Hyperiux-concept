// Built using Hyperiux Vault: https://vault.hyperiux.com
import "./ordin-styles.css";
import "./blog.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { DM_Sans } from "next/font/google";
import Header from "./components/Header";
import LenisSmoothScroll from "./components/LenisSmoothScroll";
import RouteReset from "./components/Animations/RouteReset";
import EnquiryDialog from "./components/EnquiryDialog";
import BlockTransition from "./components/effects/block-transition";
import { THEME, themeCss } from "./theme";

const Footer = dynamic(() => import("./components/Footer"));

const bodyFont = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-ord-body",
  display: "swap",
});

// Fallback for any page without its own metadata, such as the 404, so the server title is never the framework default
export const metadata: Metadata = {
  title: "Page not found | Ordin",
  description: "This page does not exist. Head back home or talk to the team.",
};

// Shared by every Ordin page: fonts, smooth scroll, grain, header and the parallax footer
const layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className={`ord-page relative overflow-x-clip ${bodyFont.variable}`}>
      {/* Colour tokens from theme.ts, as --ord-* custom properties for the CSS and Tailwind classes */}
      <style>{themeCss}</style>
      <LenisSmoothScroll />
      <div aria-hidden className="ord-noise pointer-events-none fixed inset-0 z-40" />
      <Header />
      <noscript>
        <style>{"[data-ord-loader]{display:none!important}.ord-page [data-ord-hide]{visibility:visible!important}"}</style>
      </noscript>
      <RouteReset />
      <EnquiryDialog />
      {/* Mint blocks sweep across between pages; the header and footer stay put underneath */}
      <BlockTransition rows={6} color={THEME.primary} duration={0.9}>
        {children}
      </BlockTransition>
      <Footer />
    </div>
  );
};

export default layout;
