"use client";
import { createContext, useContext } from "react";

const Ctx = createContext<{ userId: string; username: string } | null>(null);

export function UserProvider({
  userId, username, children,
}: { userId: string; username: string; children: React.ReactNode }) {
  return <Ctx.Provider value={{ userId, username }}>{children}</Ctx.Provider>;
}

export function useUser() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUser must be used inside UserProvider");
  return v;
}
