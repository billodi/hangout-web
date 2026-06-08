import Link from "next/link";
import { siteName, siteTagline } from "@/lib/site";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mx-auto w-full max-w-[1500px] px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 lg:px-8 lg:pb-8">
      <div className="shell-panel px-5 py-6 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="space-y-2">
            <p className="label-kicker">{siteName}</p>
            <p className="text-sm leading-relaxed text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">{siteTagline}</p>
          </div>

          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[color-mix(in_oklab,var(--muted)_72%,transparent)]">
              Explore
            </p>
            <nav className="mt-3 flex flex-col gap-2 text-sm font-medium">
              <Link href="/map" className="hover:text-[var(--accent2)]">
                Map
              </Link>
              <Link href="/feed" className="hover:text-[var(--accent2)]">
                Feed
              </Link>
              <Link href="/community" className="hover:text-[var(--accent2)]">
                Community
              </Link>
              <Link href="/reviews" className="hover:text-[var(--accent2)]">
                Reviews
              </Link>
              <Link href="/profile" className="hover:text-[var(--accent2)]">
                Profile
              </Link>
            </nav>
          </div>

          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[color-mix(in_oklab,var(--muted)_72%,transparent)]">
              Platform
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
              <li>Next.js + Neon Postgres</li>
              <li>PWA-ready with push notifications</li>
              <li>
                <Link href="/api/health" className="font-medium hover:text-[var(--accent2)]">
                  System health
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-6 border-t border-[color-mix(in_oklab,var(--border)_65%,transparent)] pt-4 text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
          © {year} {siteName}. Built for real-world community coordination.
        </p>
      </div>
    </footer>
  );
}
