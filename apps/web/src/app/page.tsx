import { redirect } from "next/navigation";

export default function HomePage() {
  // Root redirects to dashboard (auth check done in layout)
  redirect("/dashboard");
}
