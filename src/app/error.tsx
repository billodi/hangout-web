"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="relative z-10 mx-auto w-full max-w-[900px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 lg:px-8 lg:pb-10 lg:pt-10">
      <section className="shell-panel p-6">
        <p className="label-kicker">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-semibold" data-heading="true">
          We hit a temporary issue.
        </h1>
        <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
          Please try again. If the issue continues, refresh the page.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="action-primary" onClick={reset}>
            Try again
          </button>
          <a href="/map" className="action-ghost">
            Back to map
          </a>
        </div>
        <p className="mt-3 text-xs text-[color-mix(in_oklab,var(--muted)_72%,transparent)]">{error.message}</p>
      </section>
    </main>
  );
}
