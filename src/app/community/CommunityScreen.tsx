"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Toast, { type ToastTone } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatWhenShort } from "@/lib/formatWhen";

type Badge = { id: string; label: string; description: string };

type ProfileSummary = {
  id: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isAdmin: number;
  role: string;
  visibleRole: "owner" | "admin" | "moderator" | null;
  createdAt: string;
  createdCount: number;
  joinedCount: number;
  diaryCount: number;
  reviewCount: number;
  avgRating: number | null;
  badges: Badge[];
  isCurrentUser: boolean;
};

type ProfileDetail = {
  profile: {
    id: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    isAdmin: number;
    role: string;
    visibleRole: "owner" | "admin" | "moderator" | null;
    createdAt: string;
  };
  stats: {
    createdCount: number;
    joinedCount: number;
    diaryCount: number;
    reviewCount: number;
    avgRating: number | null;
    badges: Badge[];
  };
  reviews: Array<{
    id: string;
    authorUserId: string;
    rating: number;
    comment: string;
    activityId: string | null;
    activityTitle: string | null;
    reviewType: "profile" | "activity";
    createdAt: string;
    author: { id: string; displayName: string; avatarUrl: string | null } | null;
  }>;
  gallery: Array<{
    id: string;
    activityId: string | null;
    activityTitle: string | null;
    imageUrl: string;
    caption: string;
    location: string | null;
    lat: number | null;
    lng: number | null;
    createdAt: string;
  }>;
  recentActivities: Array<{
    id: string;
    title: string;
    location: string;
    whenISO: string;
    lat: number | null;
    lng: number | null;
  }>;
};

type User = { id: string } | null;

function Avatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className="rounded-full object-cover border border-[color-mix(in_oklab,var(--border)_85%,transparent)]"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="rounded-full border border-[color-mix(in_oklab,var(--border)_85%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)] grid place-items-center text-xs font-bold"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
}

function roleBadgeClass(role: "owner" | "admin" | "moderator" | null): string {
  if (role === "owner") return "border-[color-mix(in_oklab,#d946ef_45%,transparent)] bg-[color-mix(in_oklab,#d946ef_16%,transparent)] text-[color-mix(in_oklab,#d946ef_70%,var(--text)_30%)]";
  if (role === "admin") return "border-[color-mix(in_oklab,#f43f5e_45%,transparent)] bg-[color-mix(in_oklab,#f43f5e_14%,transparent)] text-[color-mix(in_oklab,#f43f5e_70%,var(--text)_30%)]";
  if (role === "moderator") return "border-[color-mix(in_oklab,#f59e0b_50%,transparent)] bg-[color-mix(in_oklab,#f59e0b_14%,transparent)] text-[color-mix(in_oklab,#f59e0b_74%,var(--text)_26%)]";
  return "border-[color-mix(in_oklab,var(--border)_75%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_40%,transparent)] text-[color-mix(in_oklab,var(--muted)_78%,transparent)]";
}

function roleBadgeLabel(role: "owner" | "admin" | "moderator" | null): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  return "";
}

export default function CommunityScreen({ initialUser }: { initialUser: User }) {
  const userId = initialUser?.id ?? null;

  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(userId);
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);
  const [query, setQuery] = useState("");
  const [mobileMode, setMobileMode] = useState<"list" | "detail">("list");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => `${p.displayName} ${p.bio ?? ""}`.toLowerCase().includes(q));
  }, [profiles, query]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await apiFetch<ProfileSummary[]>("/api/profiles");
        setProfiles(rows);
        setSelectedProfileId((prev) => prev ?? rows[0]?.id ?? null);
      } catch (error) {
        setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load community" });
      }
    })();
  }, []);

  useEffect(() => {
    const target = selectedProfileId;
    if (!target) return;
    let cancelled = false;
    void (async () => {
      try {
        setLoadingDetail(true);
        const next = await apiFetch<ProfileDetail>(`/api/profiles/${target}`);
        if (cancelled) return;
        setDetail(next);
      } catch (error) {
        if (!cancelled) setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load profile" });
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId]);

  function jumpToActivity(activityId: string) {
    window.location.href = `/map?activity=${encodeURIComponent(activityId)}`;
  }

  const listPanel = (
    <aside className="shell-panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
            Community
          </p>
          <h2 className="text-lg font-semibold" data-heading="true">
            People
          </h2>
        </div>
        <Link href="/reviews">
          <Button size="sm" variant="primary">
            Reviews
          </Button>
        </Link>
      </div>

      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" />

      <div className="max-h-[70vh] overflow-auto space-y-2 pr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No matches.</p>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedProfileId(p.id);
                setMobileMode("detail");
              }}
              className="w-full rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)] p-3 text-left transition hover:bg-[color-mix(in_oklab,var(--surface2)_52%,transparent)]"
            >
              <div className="flex items-center gap-2">
                <Avatar name={p.displayName} avatarUrl={p.avatarUrl} size={36} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{p.displayName}</p>
                    {p.visibleRole ? (
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadgeClass(p.visibleRole)}`}>
                        {roleBadgeLabel(p.visibleRole)}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
                    {p.avgRating !== null ? `${p.avgRating.toFixed(1)}★` : "No rating"} • {p.reviewCount} reviews
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );

  const detailPanel = (
    <section className="shell-panel p-4">
      {loadingDetail ? (
        <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Loading…</p>
      ) : !detail ? (
        <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Select a person.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={detail.profile.displayName} avatarUrl={detail.profile.avatarUrl} size={44} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold truncate" data-heading="true">
                    {detail.profile.displayName}
                  </h2>
                  {detail.profile.visibleRole ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadgeClass(detail.profile.visibleRole)}`}>
                      {roleBadgeLabel(detail.profile.visibleRole)}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">{detail.profile.bio || "No bio yet."}</p>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2">
              <Link href="/reviews">
                <Button size="sm" variant="secondary">
                  Review
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            <div className="metric-card">
              <p className="metric-label">Created</p>
              <p className="metric-value text-xl">{detail.stats.createdCount}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Joined</p>
              <p className="metric-value text-xl">{detail.stats.joinedCount}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Diary</p>
              <p className="metric-value text-xl">{detail.stats.diaryCount}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Reviews</p>
              <p className="metric-value text-xl">{detail.stats.reviewCount}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Rating</p>
              <p className="metric-value text-xl">{detail.stats.avgRating ?? "-"}</p>
            </div>
          </div>

          {detail.stats.badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {detail.stats.badges.map((b) => (
                <span
                  key={b.id}
                  title={b.description}
                  className="rounded-full border border-[color-mix(in_oklab,var(--border)_75%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_40%,transparent)] px-3 py-1 text-xs font-semibold"
                >
                  {b.label}
                </span>
              ))}
            </div>
          ) : null}

          {detail.recentActivities.length > 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold" data-heading="true">
                  Recent activities
                </h3>
                <p className="text-xs text-[color-mix(in_oklab,var(--muted)_72%,transparent)]">{detail.recentActivities.length}</p>
              </div>
              <div className="mt-2 space-y-2">
                {detail.recentActivities.slice(0, 6).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => jumpToActivity(a.id)}
                    className="w-full rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)] px-3 py-2 text-left hover:bg-[color-mix(in_oklab,var(--surface2)_52%,transparent)]"
                  >
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
                      {a.location} • {formatWhenShort(a.whenISO)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3">
              <h3 className="text-base font-semibold" data-heading="true">
                Reviews
              </h3>
              {detail.reviews.length === 0 ? (
                <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No reviews yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {detail.reviews.slice(0, 6).map((r) => (
                    <div key={r.id} className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{r.author?.displayName ?? "User"}</p>
                        <p className="text-xs font-bold text-[color-mix(in_oklab,var(--accent3)_75%,var(--text)_25%)]">{r.rating}/5</p>
                      </div>
                      <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">{r.comment}</p>
                      <p className="mt-1 text-[11px] text-[color-mix(in_oklab,var(--muted)_68%,transparent)]">{formatWhenShort(r.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3">
              <h3 className="text-base font-semibold" data-heading="true">
                Photo diary
              </h3>
              {detail.gallery.length === 0 ? (
                <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No entries yet.</p>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {detail.gallery.slice(0, 4).map((g) => (
                    <div key={g.id} className="overflow-hidden rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)]">
                      <div className="relative h-36 w-full">
                        <Image src={g.imageUrl} alt={g.caption} fill unoptimized className="object-cover" sizes="100vw" />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold">{g.caption}</p>
                        {g.activityTitle ? (
                          <p className="mt-1 text-xs font-medium text-[color-mix(in_oklab,var(--accent3)_70%,var(--text)_30%)]">{g.activityTitle}</p>
                        ) : null}
                        {g.location ? <p className="text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)] mt-1">{g.location}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:hidden grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setMobileMode("list")}>
              Back
            </Button>
            <Link href="/reviews" className="block">
              <Button className="w-full" variant="primary">
                Review
              </Button>
            </Link>
          </div>
        </div>
      )}
    </section>
  );

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1500px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-10 lg:pt-6">
      <div className="hidden lg:grid gap-4 lg:grid-cols-[360px_1fr]">
        {listPanel}
        {detailPanel}
      </div>

      <div className="lg:hidden">
        {mobileMode === "list" ? listPanel : detailPanel}
      </div>

      <Toast toast={toast} onClear={() => setToast(null)} />
    </main>
  );
}

