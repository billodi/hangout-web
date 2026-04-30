import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative z-10 mx-auto w-full max-w-[900px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 lg:px-8 lg:pb-10 lg:pt-10">
      <section className="shell-panel p-6">
        <p className="label-kicker">404</p>
        <h1 className="mt-2 text-2xl font-semibold" data-heading="true">
          This page does not exist.
        </h1>
        <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
          Lets get you back to live activities and the community feed.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href="/map" className="action-primary">
            Open map
          </Link>
          <Link href="/community" className="action-ghost">
            Browse people
          </Link>
        </div>
      </section>
    </main>
  );
}
