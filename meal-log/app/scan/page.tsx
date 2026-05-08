import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ScanClient from "./ScanClient";

export default async function ScanPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("barcode_number")
    .eq("id", user.id)
    .single();

  return <ScanClient barcode={profile?.barcode_number || null} />;
}
