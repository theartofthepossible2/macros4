import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ManualClient from "./ManualClient";

export default async function ManualPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <ManualClient />;
}
