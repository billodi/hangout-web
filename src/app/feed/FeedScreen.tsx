"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Toast, { type ToastTone } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatWhenShort } from "@/lib/formatWhen";

type User = { id: string } | null;

type FeedActivity = {
  id: string;
  creatorId: string | null;
  creatorName: string;
  title: string;
  description: string | null;
  location: string;
  whenISO: string;
  type: "chill" | "active" | "help";
  going: number;
  limit: number | null;
  createdAt: string;
  joined: boolean;
};

type FeedDiary = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  imageUrl: string;
  caption: string;
  location: string | null;
  createdAt: string;
  activityId: string | null;
};

export default function FeedScreen({ initialUser }: { initialUser: User }) {
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [diary, setDiary] = useState<FeedDiary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialUser?.id) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await apiFetch<{ activities: FeedActivity[]; diary: FeedDiary[] }>("/api/feed", { cache: "no-store" });
        if (cancelled) return;
        setActivities(data.activities);
        setDiary(data.diary);
      } catch (error) {
        if (!cancelled) setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load feed" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialUser?.id]);

  if (!initialUser?.id) {
    return (
      <main className="relative z-10 mx-auto w-full max-w-[1500px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-10 lg:pt-6">
        <section className="shell-panel p-4">
          <h1 className="text-xl font-semibold" data-heading="true">
            Feed
          </h1>
          <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Sign in to see updates from people you follow.</p>
          <Link href="/community" className="inline-flex mt-3">
            <Button variant="primary">Go to community</Button>
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1500px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-10 lg:pt-6">
      <section className="shell-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">Following</p>
            <h1 className="text-xl font-semibold" data-heading="true">
              Feed
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href="/community">
              <Button size="sm" variant="ghost">
                Community
              </Button>
            </Link>
            <button
              type="button"
              className="tab-chip tab-chip-active"
              onClick={() => {
                setLoading(true);
                void apiFetch<{ activities: FeedActivity[]; diary: FeedDiary[] }>("/api/feed", { cache: "no-store" })
                  .then((data) => {
                    setActivities(data.activities);
                    setDiary(data.diary);
                  })
                  .catch(() => setToast({ tone: "error", message: "Could not refresh" }))
                  .finally(() => setLoading(false));
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? <p className="mt-3 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Loading…</p> : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3 lg:p-4">
            <h2 className="text-base font-semibold" data-heading="true">
              Activities
            </h2>
            {activities.length === 0 ? (
              <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No activity posts yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {activities.slice(0, 20).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => (window.location.href = `/map?activity=${encodeURIComponent(a.id)}`)}
                    className="w-full rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)] px-3 py-2 text-left hover:bg-[color-mix(in_oklab,var(--surface2)_52%,transparent)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="text-[11px] text-[color-mix(in_oklab,var(--muted)_72%,transparent)]">{a.creatorName}</p>
                    </div>
                    <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
                      {a.location} • {formatWhenShort(a.whenISO)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3 lg:p-4">
            <h2 className="text-base font-semibold" data-heading="true">
              Photo diary
            </h2>
            {diary.length === 0 ? (
              <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No diary posts yet.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {diary.slice(0, 12).map((d) => (
                  <div key={d.id} className="overflow-hidden rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)]">
                    <div className="relative h-36 w-full">
                      <Image src={d.imageUrl} alt={d.caption} fill unoptimized className="object-cover" sizes="100vw" />
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{d.caption}</p>
                        <p className="text-[11px] text-[color-mix(in_oklab,var(--muted)_72%,transparent)]">{d.authorName}</p>
                      </div>
                      {d.location ? <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">{d.location}</p> : null}
                      <p className="mt-1 text-[11px] text-[color-mix(in_oklab,var(--muted)_68%,transparent)]">{formatWhenShort(d.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      <Toast toast={toast} onClear={() => setToast(null)} />
    </main>
  );
}

