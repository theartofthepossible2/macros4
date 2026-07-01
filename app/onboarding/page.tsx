import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("username, onboarded_at").eq("id", user.id).single();

  if (profile?.onboarded_at) redirect("/macros");

  return <OnboardingForm username={profile?.username ?? "there"} />;
}
