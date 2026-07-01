"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toAuthEmail } from "@/lib/constants";

export type AuthState = { error: string | null };

function validate(username: string, password: string): string | null {
  if (username.trim().length < 3) return "Username must be at least 3 characters.";
  if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim()))
    return "Username can use letters, numbers, and _ . - only.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: toAuthEmail(username),
    password,
  });
  if (error) return { error: "Wrong username or password." };
  redirect("/");
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const invalid = validate(username, password);
  if (invalid) return { error: invalid };

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: toAuthEmail(username),
    password,
    options: { data: { username: username.trim() } },
  });
  if (error) {
    if (error.message.toLowerCase().includes("already"))
      return { error: "That username is taken." };
    return { error: error.message };
  }
  redirect("/onboarding");
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
