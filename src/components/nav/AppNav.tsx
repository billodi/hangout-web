"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", theme);
}

function loadTheme(): Theme {
  try {
    const v = window.localStorage.getItem("billixa-theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // ignore
  }
  return "system";
}

function saveTheme(theme: Theme) {
  try {
    window.localStorage.setItem("billixa-theme", theme);
  } catch {
    // ignore
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const initial = loadTheme();
    setTheme(initial);
    setSystemTheme(getSystemTheme());
    applyTheme(initial);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(getSystemTheme());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const label = useMemo(() => {
    const resolved = theme === "system" ? systemTheme : theme;
    return resolved === "dark" ? "Dark" : "Light";
  }, [theme, systemTheme]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        const next: Theme = theme === "system" ? (systemTheme === "dark" ? "light" : "dark") : theme === "dark" ? "light" : "dark";
        setTheme(next);
        saveTheme(next);
        applyTheme(next);
      }}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {label}
    </Button>
  );
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-2xl border border-[color-mix(in_oklab,var(--border)_75%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_40%,transparent)]">
      {children}
    </span>
  );
}

export default function AppNav({ active }: { active: "map" | "community" | "profile" | "reviews" | "admin" | null }) {
  const pathname = usePathname();
  const inferred: typeof active = useMemo(() => {
    if (!pathname) return null;
    if (pathname.startsWith("/admin")) return "admin";
    if (pathname.startsWith("/reviews")) return "reviews";
    if (pathname.startsWith("/profile")) return "profile";
    if (pathname.startsWith("/community")) return "community";
    if (pathname.startsWith("/map")) return "map";
    return null;
  }, [pathname]);
  const current = active ?? inferred;

  return (
    <>
      <header className="relative z-20 mx-auto w-full max-w-[1500px] px-3 pt-3 lg:px-8 lg:pt-8">
        <div className="shell-panel px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/map" className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
                Social atlas
              </p>
              <p className="truncate text-lg font-bold tracking-tight" data-heading="true">
                <span className="text-gradient">BilliXa</span>
              </p>
            </Link>

            <div className="hidden items-center gap-2 lg:flex">
              <Link className={cn("tab-chip", current === "map" && "tab-chip-active")} href="/map">
                Map
              </Link>
              <Link className={cn("tab-chip", current === "community" && "tab-chip-active")} href="/community">
                Community
              </Link>
              <Link className={cn("tab-chip", current === "reviews" && "tab-chip-active")} href="/reviews">
                Reviews
              </Link>
              <Link className={cn("tab-chip", current === "profile" && "tab-chip-active")} href="/profile">
                Me
              </Link>
              <ThemeToggle />
            </div>

            <div className="lg:hidden">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[color-mix(in_oklab,var(--border)_75%,transparent)] bg-[color-mix(in_oklab,var(--surface)_40%,transparent)] backdrop-blur-[var(--blur)] lg:hidden">
        <div className="mx-auto flex max-w-[1500px] items-center justify-around px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <Link
            href="/map"
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-semibold",
              current === "map" ? "text-[color-mix(in_oklab,var(--accent)_75%,var(--text)_25%)]" : "text-[color-mix(in_oklab,var(--muted)_70%,transparent)]",
            )}
          >
            <NavIcon>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </NavIcon>
            Map
          </Link>

          <Link
            href="/community"
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-semibold",
              current === "community" ? "text-[color-mix(in_oklab,var(--accent)_75%,var(--text)_25%)]" : "text-[color-mix(in_oklab,var(--muted)_70%,transparent)]",
            )}
          >
            <NavIcon>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </NavIcon>
            People
          </Link>

          <Link
            href="/profile"
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-semibold",
              current === "profile" ? "text-[color-mix(in_oklab,var(--accent)_75%,var(--text)_25%)]" : "text-[color-mix(in_oklab,var(--muted)_70%,transparent)]",
            )}
          >
            <NavIcon>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </NavIcon>
            Me
          </Link>
        </div>
      </nav>
    </>
  );
}

