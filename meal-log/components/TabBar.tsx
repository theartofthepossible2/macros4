"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/scan", label: "Capture", icon: "M4 7l4-3h8l4 3M4 7v12a1 1 0 001 1h14a1 1 0 001-1V7M4 7h16M12 11a3 3 0 100 6 3 3 0 000-6z" },
  { href: "/manual", label: "Manual", icon: "M4 20h16M6 16l8-8 4 4-8 8H6v-4z" },
  { href: "/settings", label: "Settings", icon: "M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h2M19 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav style={{
      flexShrink: 0,
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      borderTop: "0.5px solid rgba(0,0,0,0.12)",
      background: "white",
    }}>
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              padding: "10px 0 14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: active ? "#111" : "#7a7a78",
              fontWeight: active ? 500 : 400,
              textDecoration: "none",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon} />
            </svg>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
