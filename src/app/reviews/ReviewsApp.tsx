"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
};

type ProfileSummary = {
  id: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  reviewCount: number;
  avgRating: number | null;
};

type ProfileDetail = {
  profile: { id: string; displayName: string; bio: string };
  reviews: Array<{
    id: string;
    rating: number;
    comment: string;
    reviewType: "profile" | "activity";
    activityTitle: string | null;
    createdAt: string;
    author: { displayName: string } | null;
  }>;
  reviewContext: {
    canSubmitProfileReview: boolean;
    hasProfileReview: boolean;
    eligibleActivities: Array<{ id: string; title: string; location: string }>;
    reviewedActivityIds: string[];
  } | null;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type") && options?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers, credentials: "include", cache: "no-store" });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const msg = (data as { error?: string } | null)?.error;
    throw new Error(msg || `Request failed (${response.status})`);
  }
  return data as T;
}

export default function ReviewsApp({ initialUser }: { initialUser: User | null }) {
  const [user] = useState<User | null>(initialUser);
  const userId = user?.id ?? null;
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileDetail, setProfileDetail] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMode, setReviewMode] = useState<"profile" | "activity">("profile");
  const [reviewActivityId, setReviewActivityId] = useState("");

  const availableActivityReviewOptions = useMemo(() => {
    if (!profileDetail?.reviewContext) return [];
    const reviewed = new Set(profileDetail.reviewContext.reviewedActivityIds);
    return profileDetail.reviewContext.eligibleActivities.filter((activity) => !reviewed.has(activity.id));
  }, [profileDetail]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await apiFetch<ProfileSummary[]>("/api/profiles");
        const candidates = userId ? rows.filter((p) => p.id !== userId) : rows;
        setProfiles(candidates);
        setSelectedProfileId((prev) => prev ?? candidates[0]?.id ?? null);
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Could not load profiles");
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!selectedProfileId) return;
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const detail = await apiFetch<ProfileDetail>(`/api/profiles/${selectedProfileId}`);
        if (cancelled) return;
        setProfileDetail(detail);
        syncReviewSelection(detail);
      } catch (error) {
        if (!cancelled) setToast(error instanceof Error ? error.message : "Could not load review data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId]);

  function syncReviewSelection(detail: ProfileDetail) {
    const ctx = detail.reviewContext;
    if (!ctx) {
      setReviewActivityId("");
      setReviewMode("profile");
      return;
    }
    const reviewed = new Set(ctx.reviewedActivityIds);
    const options = ctx.eligibleActivities.filter((activity) => !reviewed.has(activity.id));
    setReviewActivityId((prev) => (prev && options.some((a) => a.id === prev) ? prev : options[0]?.id ?? ""));
    if (!ctx.canSubmitProfileReview && options.length > 0) setReviewMode("activity");
  }

  async function postReview() {
    if (!user || !profileDetail) return;
    try {
      await apiFetch(`/api/profiles/${profileDetail.profile.id}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          rating: Number.parseInt(reviewRating, 10),
          comment: reviewComment,
          reviewType: reviewMode,
          activityId: reviewMode === "activity" ? reviewActivityId : null,
        }),
      });
      setReviewComment("");
      setReviewRating("5");
      setToast("Review posted.");
      const detail = await apiFetch<ProfileDetail>(`/api/profiles/${profileDetail.profile.id}`);
      setProfileDetail(detail);
      syncReviewSelection(detail);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not post review");
    }
  }

  return (
    <main className="relative z-10 mx-auto mt-4 max-w-6xl px-3 lg:px-8 text-white pb-8">
      <section className="shell-panel p-3 lg:p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl lg:text-2xl font-semibold">Reviews</h1>
          <div className="flex gap-2">
            <Link href="/map" className="action-ghost">Home</Link>
            <Link href="/profile" className="action-ghost">My Profile</Link>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-white/20 bg-black/20 p-3">
            <h2 className="text-base font-semibold">People to review</h2>
            <div className="mt-2 space-y-1.5 max-h-[520px] overflow-auto">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${selectedProfileId === profile.id ? "border-orange-400 bg-orange-500/12" : "border-white/15 bg-white/5"}`}
                >
                  <p className="text-sm font-semibold">{profile.displayName}</p>
                  <p className="text-xs text-white/65">
                    {profile.avgRating !== null ? `${profile.avgRating.toFixed(1)} stars` : "No rating"} - {profile.reviewCount} reviews
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-2xl border border-white/20 bg-black/20 p-3 lg:p-4">
            {loading ? (
              <p className="text-sm text-white/70">Loading review panel...</p>
            ) : !profileDetail ? (
              <p className="text-sm text-white/70">Select someone to view/post reviews.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">{profileDetail.profile.displayName}</h2>
                  <p className="text-sm text-white/70">{profileDetail.profile.bio || "No bio yet."}</p>
                </div>

                {!user ? (
                  <p className="text-sm text-white/70">Login from the home page to post reviews.</p>
                ) : (
                  <article className="rounded-xl border border-white/15 bg-white/5 p-3 space-y-2">
                    <h3 className="text-sm font-semibold">Write review</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => setReviewMode("profile")} className={`action-ghost ${reviewMode === "profile" ? "bg-white/20" : ""}`} disabled={!profileDetail.reviewContext?.canSubmitProfileReview}>
                        Whole profile
                      </button>
                      <button type="button" onClick={() => setReviewMode("activity")} className={`action-ghost ${reviewMode === "activity" ? "bg-white/20" : ""}`} disabled={availableActivityReviewOptions.length === 0}>
                        Specific activity
                      </button>
                    </div>

                    {reviewMode === "activity" ? (
                      <select value={reviewActivityId} onChange={(e) => setReviewActivityId(e.target.value)} className="field">
                        {availableActivityReviewOptions.length === 0 ? <option value="">No shared activities</option> : null}
                        {availableActivityReviewOptions.map((activity) => (
                          <option key={activity.id} value={activity.id}>
                            {activity.title} - {activity.location}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    <div className="grid grid-cols-[100px_1fr] gap-2">
                      <select value={reviewRating} onChange={(e) => setReviewRating(e.target.value)} className="field">
                        <option value="5">5 stars</option>
                        <option value="4">4 stars</option>
                        <option value="3">3 stars</option>
                        <option value="2">2 stars</option>
                        <option value="1">1 star</option>
                      </select>
                      <input value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="field" placeholder="Comment" />
                    </div>
                    <button type="button" onClick={() => void postReview()} className="action-primary">
                      Post Review
                    </button>
                  </article>
                )}

                <article className="rounded-xl border border-white/15 bg-white/5 p-3">
                  <h3 className="text-sm font-semibold">All reviews</h3>
                  {profileDetail.reviews.length === 0 ? (
                    <p className="mt-2 text-sm text-white/70">No reviews yet.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {profileDetail.reviews.map((review) => (
                        <div key={review.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{review.author?.displayName ?? "User"}</p>
                            <p className="text-xs text-white/65">{review.rating}/5</p>
                          </div>
                          <p className="text-[11px] text-white/55 mt-1">
                            {review.reviewType === "activity" ? `Activity review${review.activityTitle ? ` - ${review.activityTitle}` : ""}` : "Whole profile review"}
                          </p>
                          <p className="text-sm text-white/80 mt-1">{review.comment}</p>
                          <p className="text-xs text-white/55 mt-1">{formatWhen(review.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </div>
            )}
          </section>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-full bg-emerald-500 text-white px-4 py-2 text-sm font-medium shadow-lg">{toast}</div>
        </div>
      ) : null}
    </main>
  );
}
