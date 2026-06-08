import Link from "next/link";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="relative z-10 mx-auto w-full max-w-[900px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 lg:px-8 lg:pb-10 lg:pt-10">
      <section className="shell-panel p-8 text-center sm:p-10">
        <p className="label-kicker">404</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl" data-heading="true">
          This page does not exist.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
          Let&apos;s get you back to live activities and the community feed.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href="/map">
            <Button variant="primary">Open map</Button>
          </Link>
          <Link href="/community">
            <Button variant="ghost">Browse people</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
