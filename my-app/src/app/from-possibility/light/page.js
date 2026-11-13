import Journey from "@/components/PossibilityJourney/Journey";

export const metadata = {
  title: "From Possibility to Experience (Light) · Hyperiux",
  description: "Hyperiux, a growth and experience partner where human behaviour, design, technology and organic growth meet.",
  robots: {
    index: false,
    follow: false,
  },
};

// the light version: warm limestone in daylight
export default function FromPossibilityLightPage() {
  return <Journey theme="light" />;
}
