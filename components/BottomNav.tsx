"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/lifting", label: "lifting", icon: Dumbbell },
  { href: "/cardio", label: "cardio", icon: Heart },
  { href: "/macros", label: "macros", icon: Fork },
  { href: "/progress", label: "progress", icon: Chart },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line/60 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-1 text-[11px] ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon active={active} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

type IconProps = { active?: boolean };
const stroke = (a?: boolean) => (a ? "#2f9bff" : "#8a8a90");

function Dumbbell({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round">
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </svg>
  );
}
function Heart({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#2f9bff" : "none"} stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.5 12 20 12 20Z" />
    </svg>
  );
}
function Fork({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 3c-1.5 1-2 3-2 5s.5 3 2 3v10" />
    </svg>
  );
}
function Chart({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19h16M6 16l4-5 3 3 5-7" />
    </svg>
  );
}
