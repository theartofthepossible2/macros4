import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";
import { BodyInputs } from "./BodyInputs";
import { DataControls } from "./DataControls";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("username, units").eq("id", user.id).single();

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight px-1">settings</h1>

      <div className="rounded-2xl bg-card border border-line/60 divide-y divide-line/60">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted">username</span>
          <span className="font-medium">{profile?.username}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted">units</span>
          <span className="font-medium capitalize">{profile?.units ?? "imperial"}</span>
        </div>
      </div>

      <BodyInputs />

      <DataControls />

      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-xl bg-transparent px-4 py-3 text-sm font-semibold text-bad transition hover:bg-bad/10"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
