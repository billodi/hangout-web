export default function GlobalLoading() {
  return (
    <main className="relative z-10 mx-auto w-full max-w-[1500px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 lg:px-8 lg:pb-10 lg:pt-10">
      <section className="shell-panel p-6">
        <p className="label-kicker">BilliXa</p>
        <h1 className="mt-2 text-2xl font-semibold" data-heading="true">
          Loading your community hub...
        </h1>
        <div className="mt-4 space-y-2">
          <div className="h-4 w-2/3 rounded-md bg-[color-mix(in_oklab,var(--surface2)_75%,transparent)] skeleton" />
          <div className="h-4 w-1/2 rounded-md bg-[color-mix(in_oklab,var(--surface2)_75%,transparent)] skeleton" />
          <div className="h-28 w-full rounded-xl bg-[color-mix(in_oklab,var(--surface2)_75%,transparent)] skeleton" />
        </div>
      </section>
    </main>
  );
}
