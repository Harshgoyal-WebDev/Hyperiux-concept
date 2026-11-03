import { Archivo, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "@/components/ArchitecturalConcept/concept.css";
import "@/components/ArchitecturalConcept/chapters/overlays.css";

// The concept's three faces: Archivo for display (with its width axis),
// Instrument Sans for body copy, IBM Plex Mono for drawing labels.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

export default function ArchitecturalConceptLayout({ children }) {
  return <div className={`${archivo.variable} ${instrument.variable} ${plexMono.variable} contents`}>{children}</div>;
}
