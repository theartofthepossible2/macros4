import { redirect } from "next/navigation";

// Middleware guarantees an authenticated user here; the (app) group enforces
// onboarding. Send everyone to the first tab.
export default function Home() {
  redirect("/macros");
}
