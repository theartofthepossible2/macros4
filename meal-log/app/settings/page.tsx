import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("full_name, barcode_number").eq("id", user.id).single(),
    supabase.from("preferences").select("display_mode, units").eq("user_id", user.id).single(),
  ]);

  return (
    <SettingsClient
      email={user.email || ""}
      fullName={profile?.full_name || ""}
      barcode={profile?.barcode_number || ""}
      displayMode={prefs?.display_mode || "full_macros"}
      units={prefs?.units || "metric"}
    />
  );
}
