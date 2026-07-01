"use client";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { login, type AuthState } from "../actions";

const initial: AuthState = { error: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? "Logging in…" : "Log in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, action] = useFormState(login, initial);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">macros4</h1>
        <p className="text-sm text-muted">Log in to your account.</p>
      </div>
      <form action={action} className="space-y-3">
        <input
          name="username" autoComplete="username" placeholder="Username" autoCapitalize="none"
          className="w-full rounded-xl bg-card border border-line px-4 py-3 outline-none"
        />
        <input
          name="password" type="password" autoComplete="current-password" placeholder="Password"
          className="w-full rounded-xl bg-card border border-line px-4 py-3 outline-none"
        />
        {state.error ? <p className="text-sm text-bad">{state.error}</p> : null}
        <Submit />
      </form>
      <p className="text-center text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="text-accent">Create one</Link>
      </p>
    </main>
  );
}
