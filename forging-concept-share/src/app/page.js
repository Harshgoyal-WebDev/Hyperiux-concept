import { redirect } from "next/navigation";

// The concept lives at /forging-concept (as in the main repo).
export default function Home() {
  redirect("/forging-concept");
}
