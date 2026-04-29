"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Toast, { type ToastTone } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatWhenShort } from "@/lib/formatWhen";

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

export default function ReviewsApp({ initialUser }: { initialUser: User | null }) {
  const [user] = useState<User | null>(initialUser);
  const userId = user?.id ?? null;
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileDetail, setProfileDetail] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);
  const [mobileMode, setMobileMode] = useState<"list" | "detail">("list");

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
    void (async () => {
      try {
        const rows = await apiFetch<ProfileSummary[]>("/api/profiles");
        const candidates = userId ? rows.filter((p) => p.id !== userId) : rows;
        setProfiles(candidates);
        setSelectedProfileId((prev) => prev ?? candidates[0]?.id ?? null);
      } catch (error) {
        setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load profiles" });
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
        if (!cancelled) setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load review data" });
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
      setToast({ tone: "info", message: "Review posted." });
      const detail = await apiFetch<ProfileDetail>(`/api/profiles/${profileDetail.profile.id}`);
      setProfileDetail(detail);
      syncReviewSelection(detail);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not post review" });
    }
  }

  const listPanel = (
    <aside className="shell-panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
            Reputation
          </p>
          <h1 className="text-lg font-semibold" data-heading="true">
            Reviews
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/map">
            <Button size="sm" variant="ghost">
              Map
            </Button>
          </Link>
          <Link href="/profile">
            <Button size="sm" variant="secondary">
              Me
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto space-y-2 pr-1">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => {
              setSelectedProfileId(profile.id);
              setMobileMode("detail");
            }}
            className={`w-full rounded-[var(--radius-md)] border p-3 text-left transition hover:bg-[color-mix(in_oklab,var(--surface2)_52%,transparent)] ${
              selectedProfileId === profile.id
                ? "border-[color-mix(in_oklab,var(--accent)_55%,transparent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]"
                : "border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)]"
            }`}
          >
            <p className="text-sm font-semibold">{profile.displayName}</p>
            <p className="text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
              {profile.avgRating !== null ? `${profile.avgRating.toFixed(1)}★` : "No rating"} • {profile.reviewCount} reviews
            </p>
          </button>
        ))}
      </div>
    </aside>
  );

  const detailPanel = (
    <section className="shell-panel p-4">
      {loading ? (
        <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Loading review panel…</p>
      ) : !profileDetail ? (
        <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Select someone to view/post reviews.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold" data-heading="true">
              {profileDetail.profile.displayName}
            </h2>
            <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">{profileDetail.profile.bio || "No bio yet."}</p>
          </div>

          {!user ? (
            <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3">
              <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
                Login from the map page to post reviews.
              </p>
              <Link href="/map" className="inline-flex mt-3">
                <Button variant="primary">Go to map</Button>
              </Link>
            </div>
          ) : (
            <article className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold" data-heading="true">
                  Write review
                </h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={reviewMode === "profile" ? "primary" : "secondary"}
                    onClick={() => setReviewMode("profile")}
                    disabled={!profileDetail.reviewContext?.canSubmitProfileReview}
                  >
                    Whole
                  </Button>
                  <Button
                    size="sm"
                    variant={reviewMode === "activity" ? "primary" : "secondary"}
                    onClick={() => setReviewMode("activity")}
                    disabled={availableActivityReviewOptions.length === 0}
                  >
                    Activity
                  </Button>
                </div>
              </div>

              {reviewMode === "activity" ? (
                <Select value={reviewActivityId} onChange={(e) => setReviewActivityId(e.target.value)}>
                  {availableActivityReviewOptions.length === 0 ? <option value="">No shared activities</option> : null}
                  {availableActivityReviewOptions.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.title} - {activity.location}
                    </option>
                  ))}
                </Select>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
                <Select value={reviewRating} onChange={(e) => setReviewRating(e.target.value)}>
                  <option value="5">5 stars</option>
                  <option value="4">4 stars</option>
                  <option value="3">3 stars</option>
                  <option value="2">2 stars</option>
                  <option value="1">1 star</option>
                </Select>
                <Button variant="ghost" onClick={() => setReviewComment("")} disabled={!reviewComment.trim()}>
                  Clear
                </Button>
              </div>

              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Say what went well (or what didn’t)"
                className="min-h-20"
              />

              <Button variant="primary" onClick={() => void postReview()}>
                Post review
              </Button>
            </article>
          )}

          <article className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3">
            <h3 className="text-base font-semibold" data-heading="true">
              All reviews
            </h3>
            {profileDetail.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No reviews yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {profileDetail.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{review.author?.displayName ?? "User"}</p>
                      <p className="text-xs font-bold text-[color-mix(in_oklab,var(--accent3)_75%,var(--text)_25%)]">
                        {review.rating}/5
                      </p>
                    </div>
                    <p className="text-[11px] text-[color-mix(in_oklab,var(--muted)_72%,transparent)] mt-1">
                      {review.reviewType === "activity"
                        ? `Activity review${review.activityTitle ? ` - ${review.activityTitle}` : ""}`
                        : "Whole profile review"}
                    </p>
                    <p className="text-sm text-[color-mix(in_oklab,var(--muted)_82%,transparent)] mt-1">{review.comment}</p>
                    <p className="text-xs text-[color-mix(in_oklab,var(--muted)_68%,transparent)] mt-1">{formatWhenShort(review.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </article>

          <div className="lg:hidden grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setMobileMode("list")}>
              Back
            </Button>
            <Link href="/community" className="block">
              <Button className="w-full" variant="secondary">
                Community
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
      <div className="lg:hidden">{mobileMode === "list" ? listPanel : detailPanel}</div>
      <Toast toast={toast} onClear={() => setToast(null)} />
    </main>
  );
}
