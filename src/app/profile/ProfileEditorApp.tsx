"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Toast, { type ToastTone } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";

type User = {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
};

type ProfileDetail = {
  profile: {
    id: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  stats: {
    createdCount: number;
    joinedCount: number;
    diaryCount: number;
    reviewCount: number;
    avgRating: number | null;
  };
  gallery: Array<{
    id: string;
    imageUrl: string;
    caption: string;
    location: string | null;
    lat: number | null;
    lng: number | null;
    createdAt: string;
  }>;
};

function safeText(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ProfileEditorApp({ initialUser }: { initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);

  const [editName, setEditName] = useState(initialUser?.displayName ?? "");
  const [editBio, setEditBio] = useState(initialUser?.bio ?? "");
  const [editAvatarUrl, setEditAvatarUrl] = useState(initialUser?.avatarUrl ?? "");
  const [galleryImageUrl, setGalleryImageUrl] = useState("");
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryLocation, setGalleryLocation] = useState("");
  const [galleryLat, setGalleryLat] = useState("");
  const [galleryLng, setGalleryLng] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const profile = await apiFetch<ProfileDetail>(`/api/profiles/${user.id}`);
        if (cancelled) return;
        setDetail(profile);
        setEditName(profile.profile.displayName);
        setEditBio(profile.profile.bio ?? "");
        setEditAvatarUrl(profile.profile.avatarUrl ?? "");
      } catch (error) {
        if (!cancelled) setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load profile" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function saveProfile() {
    if (!user) return;
    try {
      const updated = await apiFetch<User>(`/api/profiles/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName: editName, bio: editBio, avatarUrl: editAvatarUrl }),
      });
      setUser(updated);
      setToast({ tone: "info", message: "Profile updated." });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not save profile" });
    }
  }

  async function postDiaryEntry() {
    if (!user) return;
    const imageUrl = safeText(galleryImageUrl);
    const caption = safeText(galleryCaption);
    if (!isValidImageUrl(imageUrl) || !caption) {
      setToast({ tone: "error", message: "Add a valid image URL and caption." });
      return;
    }

    try {
      await apiFetch(`/api/profiles/${user.id}/gallery`, {
        method: "POST",
        body: JSON.stringify({
          imageUrl,
          caption,
          location: safeText(galleryLocation) || null,
          lat: safeText(galleryLat) ? Number.parseFloat(galleryLat) : null,
          lng: safeText(galleryLng) ? Number.parseFloat(galleryLng) : null,
        }),
      });
      setGalleryImageUrl("");
      setGalleryCaption("");
      setGalleryLocation("");
      setGalleryLat("");
      setGalleryLng("");
      setToast({ tone: "info", message: "Diary entry added." });
      const profile = await apiFetch<ProfileDetail>(`/api/profiles/${user.id}`);
      setDetail(profile);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not add diary entry" });
    }
  }

  if (!user) {
    return (
      <main className="relative z-10 mx-auto w-full max-w-[1500px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-10 lg:pt-6">
        <section className="shell-panel p-4">
          <h1 className="text-xl font-semibold" data-heading="true">
            Me
          </h1>
          <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
            Please sign in first to manage your profile.
          </p>
          <Link href="/map" className="inline-flex mt-3">
            <Button variant="primary">Go to map</Button>
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
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
              Me
            </p>
            <h1 className="text-xl font-semibold" data-heading="true">
              Profile
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href="/map">
              <Button size="sm" variant="ghost">
                Map
              </Button>
            </Link>
            <Link href="/reviews">
              <Button size="sm" variant="secondary">
                Reviews
              </Button>
            </Link>
          </div>
        </div>

        {loading ? <p className="mt-3 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Loading…</p> : null}

        {detail ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3 lg:p-4 space-y-2">
              <h2 className="text-base font-semibold" data-heading="true">
                Edit profile
              </h2>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Display name" />
              <Input value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} placeholder="Avatar URL" />
              <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="min-h-20" placeholder="Bio" />
              <Button variant="primary" onClick={() => void saveProfile()}>
                Save
              </Button>
            </article>

            <article className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3 lg:p-4 space-y-2">
              <h2 className="text-base font-semibold" data-heading="true">
                Add diary entry
              </h2>
              <Input value={galleryImageUrl} onChange={(e) => setGalleryImageUrl(e.target.value)} placeholder="Image URL" />
              <Input value={galleryCaption} onChange={(e) => setGalleryCaption(e.target.value)} placeholder="Caption" />
              <Input value={galleryLocation} onChange={(e) => setGalleryLocation(e.target.value)} placeholder="Location (optional)" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={galleryLat} onChange={(e) => setGalleryLat(e.target.value)} placeholder="Lat (optional)" />
                <Input value={galleryLng} onChange={(e) => setGalleryLng(e.target.value)} placeholder="Lng (optional)" />
              </div>
              <Button variant="primary" onClick={() => void postDiaryEntry()}>
                Post
              </Button>
            </article>

            <article className="lg:col-span-2 rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_38%,transparent)] p-3 lg:p-4">
              <h2 className="text-base font-semibold" data-heading="true">
                Photo diary
              </h2>
              {detail.gallery.length === 0 ? (
                <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No entries yet.</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
                  {detail.gallery.map((entry) => (
                    <div
                      key={entry.id}
                      className="overflow-hidden rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)]"
                    >
                      <div className="relative h-40 w-full">
                        <Image src={entry.imageUrl} alt={entry.caption} fill unoptimized sizes="(max-width:1024px) 100vw, 40vw" className="object-cover" />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold">{entry.caption}</p>
                        {entry.location ? (
                          <p className="text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)] mt-1">{entry.location}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        ) : null}
      </section>

      <Toast toast={toast} onClear={() => setToast(null)} />
    </main>
  );
}
