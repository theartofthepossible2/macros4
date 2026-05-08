import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ConfirmClient from "./ConfirmClient";

export default async function ConfirmPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: prefs } = await supabase
    .from("preferences")
    .select("display_mode, units")
    .eq("user_id", user.id)
    .single();

  return <ConfirmClient displayMode={prefs?.display_mode || "full_macros"} />;
}
