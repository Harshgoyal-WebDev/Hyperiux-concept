import AboutExperience from "@/components/HyperiuxAbout/AboutExperience";

export const metadata = {
  title: "About · Hyperiux",
  description: "Revealed by light — the people behind Hyperiux.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AboutPage() {
  return <AboutExperience />;
}
