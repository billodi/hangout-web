"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import EmptyState, { EmptyStateButton } from "@/components/EmptyState";
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
  activityTitle?: string | null;
};

export default function FeedScreen({ initialUser }: { initialUser: User }) {
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [diary, setDiary] = useState<FeedDiary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [followingOnly, setFollowingOnly] = useState(false);
  const [feedView, setFeedView] = useState<"all" | "activities" | "diary">("all");
  const [diaryFilter, setDiaryFilter] = useState<"latest" | "with_location" | "linked_activity">("latest");

  function getActivityReason(activity: FeedActivity): string {
    const eventTime = new Date(activity.whenISO).getTime();
    const twoHours = 2 * 60 * 60 * 1000;
    if (Number.isFinite(eventTime) && eventTime > nowTick && eventTime <= nowTick + twoHours) {
      return "Because it starts soon";
    }
    if (activity.joined) return "Because you already joined";
    return followingOnly ? `Because you follow ${activity.creatorName}` : "Because it's public and upcoming";
  }

  async function refreshFeed() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<{ activities: FeedActivity[]; diary: FeedDiary[] }>(`/api/feed?followingOnly=${followingOnly ? "1" : "0"}`, { cache: "no-store" });
      setActivities(data.activities);
      setDiary(data.diary);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not load feed";
      setLoadError(msg);
      setToast({ tone: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!initialUser?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ activities: FeedActivity[]; diary: FeedDiary[] }>(`/api/feed?followingOnly=${followingOnly ? "1" : "0"}`, { cache: "no-store" });
        if (cancelled) return;
        setActivities(data.activities);
        setDiary(data.diary);
      } catch (error) {
        if (cancelled) return;
        const msg = error instanceof Error ? error.message : "Could not load feed";
        setLoadError(msg);
        setToast({ tone: "error", message: msg });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialUser?.id, followingOnly]);

  if (!initialUser?.id) {
    return (
      <main className="relative z-10 mx-auto w-full max-w-[1500px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-10 lg:pt-6">
        <EmptyState
          kicker="Feed"
          title="Sign in to see your personalized feed"
          description="Follow people in the community to see their upcoming activities, diary posts, and local updates."
          action={
            <>
              <Link href="/map">
                <EmptyStateButton>Sign in on map</EmptyStateButton>
              </Link>
              <Link href="/community">
                <EmptyStateButton variant="ghost">Browse community</EmptyStateButton>
              </Link>
            </>
          }
        />
      </main>
    );
  }

  const filteredDiary = diary.filter((d) => {
    if (diaryFilter === "with_location") return !!d.location;
    if (diaryFilter === "linked_activity") return !!d.activityId;
    return true;
  });

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1500px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-10 lg:pt-6">
      <section className="shell-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
              {followingOnly ? "Following" : "Public upcoming"}
            </p>
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
            <button type="button" className="tab-chip tab-chip-active" onClick={() => void refreshFeed()} aria-label="Refresh feed">
              Refresh
            </button>
          </div>
        </div>

        {loading ? <p className="mt-3 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Loading...</p> : null}
        {loadError ? (
          <p className="mt-3 rounded-[var(--radius-sm)] border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="status">
            {loadError}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant={followingOnly ? "primary" : "ghost"} onClick={() => setFollowingOnly((v) => !v)} aria-pressed={followingOnly}>
            Following only
          </Button>
          <Button size="sm" variant={feedView === "all" ? "primary" : "ghost"} onClick={() => setFeedView("all")} aria-pressed={feedView === "all"}>
            All
          </Button>
          <Button
            size="sm"
            variant={feedView === "activities" ? "primary" : "ghost"}
            onClick={() => setFeedView("activities")}
            aria-pressed={feedView === "activities"}
          >
            Activities
          </Button>
          <Button size="sm" variant={feedView === "diary" ? "primary" : "ghost"} onClick={() => setFeedView("diary")} aria-pressed={feedView === "diary"}>
            Photo diary
          </Button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {feedView !== "diary" ? (
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
                        {a.location} - {formatWhenShort(a.whenISO)}
                      </p>
                      <p className="mt-1 text-[11px] text-[color-mix(in_oklab,var(--accent2)_72%,var(--text)_28%)]">{getActivityReason(a)}</p>
                    </button>
                  ))}
                </div>
              )}
            </article>
          ) : null}

          {feedView !== "activities" ? (
            <article className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3 lg:p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold" data-heading="true">
                  Photo diary
                </h2>
                <div className="flex gap-2">
                  <Button size="sm" variant={diaryFilter === "latest" ? "primary" : "ghost"} onClick={() => setDiaryFilter("latest")} aria-pressed={diaryFilter === "latest"}>
                    Latest
                  </Button>
                  <Button
                    size="sm"
                    variant={diaryFilter === "with_location" ? "primary" : "ghost"}
                    onClick={() => setDiaryFilter("with_location")}
                    aria-pressed={diaryFilter === "with_location"}
                  >
                    With location
                  </Button>
                  <Button
                    size="sm"
                    variant={diaryFilter === "linked_activity" ? "primary" : "ghost"}
                    onClick={() => setDiaryFilter("linked_activity")}
                    aria-pressed={diaryFilter === "linked_activity"}
                  >
                    Linked
                  </Button>
                </div>
              </div>
              {filteredDiary.length === 0 ? (
                <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No diary posts found for this filter.</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {filteredDiary.slice(0, 20).map((d) => (
                    <article
                      key={d.id}
                      className="overflow-hidden rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)]"
                    >
                      <div className="relative h-36 w-full">
                        <Image src={d.imageUrl} alt={d.caption} fill unoptimized className="object-cover" sizes="100vw" />
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{d.caption}</p>
                          <p className="text-[11px] text-[color-mix(in_oklab,var(--muted)_72%,transparent)]">{d.authorName}</p>
                        </div>
                        {d.activityTitle ? (
                          <p className="mt-1 text-xs font-semibold text-[color-mix(in_oklab,var(--accent3)_70%,var(--text)_30%)]">{d.activityTitle}</p>
                        ) : null}
                        {d.location ? <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">{d.location}</p> : null}
                        <p className="mt-1 text-[11px] text-[color-mix(in_oklab,var(--muted)_68%,transparent)]">{formatWhenShort(d.createdAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>
          ) : null}
        </div>
      </section>

      <Toast toast={toast} onClear={() => setToast(null)} />
    </main>
  );
}
