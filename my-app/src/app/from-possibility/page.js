import Journey from "@/components/PossibilityJourney/Journey";

export const metadata = {
  title: "From Possibility to Experience · Hyperiux",
  description: "Hyperiux, a growth and experience partner where human behaviour, design, technology and organic growth meet.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FromPossibilityPage() {
  // the dark version (night); the light one is at /from-possibility/light
  return <Journey theme="dark" />;
}
