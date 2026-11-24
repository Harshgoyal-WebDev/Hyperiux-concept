import HyperiuxAbout from "@/components/HyperiuxAbout/HyperiuxAbout";

export const metadata = {
  title: "About · Hyperiux",
  description: "A growth and experience partner where human behaviour, design, technology and organic growth meet. Meet the team behind Hyperiux.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AboutPage() {
  return <HyperiuxAbout />;
}
