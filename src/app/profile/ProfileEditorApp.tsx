"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

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

export default function ProfileEditorApp({ initialUser }: { initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [editName, setEditName] = useState(initialUser?.displayName ?? "");
  const [editBio, setEditBio] = useState(initialUser?.bio ?? "");
  const [editAvatarUrl, setEditAvatarUrl] = useState(initialUser?.avatarUrl ?? "");
  const [galleryImageUrl, setGalleryImageUrl] = useState("");
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryLocation, setGalleryLocation] = useState("");
  const [galleryLat, setGalleryLat] = useState("");
  const [galleryLng, setGalleryLng] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
        if (!cancelled) setToast(error instanceof Error ? error.message : "Could not load profile");
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
      setToast("Profile updated.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not save profile");
    }
  }

  async function postDiaryEntry() {
    if (!user) return;
    const imageUrl = safeText(galleryImageUrl);
    const caption = safeText(galleryCaption);
    if (!isValidImageUrl(imageUrl) || !caption) {
      setToast("Add a valid image URL and caption.");
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
      setToast("Diary entry added.");
      const profile = await apiFetch<ProfileDetail>(`/api/profiles/${user.id}`);
      setDetail(profile);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not add diary entry");
    }
  }

  if (!user) {
    return (
      <main className="relative z-10 mx-auto mt-6 max-w-4xl px-3 lg:px-8 text-white">
        <section className="shell-panel p-4">
          <h1 className="text-xl font-semibold">Profile Page</h1>
          <p className="mt-2 text-sm text-white/75">Please sign in first to manage your profile.</p>
          <Link href="/map" className="action-primary inline-flex mt-3">Go Home</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto mt-4 max-w-5xl px-3 lg:px-8 text-white pb-8">
      <section className="shell-panel p-3 lg:p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl lg:text-2xl font-semibold">My Profile</h1>
          <div className="flex gap-2">
            <Link href="/map" className="action-ghost">Home</Link>
            <Link href="/reviews" className="action-ghost">Reviews</Link>
          </div>
        </div>

        {loading ? <p className="mt-3 text-sm text-white/70">Loading...</p> : null}

        {detail ? (
          <div className="mt-3 space-y-3">
            <article className="rounded-2xl border border-white/20 bg-black/20 p-3 lg:p-4 space-y-2">
              <h2 className="text-base font-semibold">Edit Profile</h2>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="field" placeholder="Display name" />
              <input value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} className="field" placeholder="Avatar URL" />
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="field min-h-20" placeholder="Bio" />
              <button type="button" onClick={() => void saveProfile()} className="action-primary">Save Profile</button>
            </article>

            <article className="rounded-2xl border border-white/20 bg-black/20 p-3 lg:p-4 space-y-2">
              <h2 className="text-base font-semibold">Add Diary Entry</h2>
              <input value={galleryImageUrl} onChange={(e) => setGalleryImageUrl(e.target.value)} className="field" placeholder="Image URL" />
              <input value={galleryCaption} onChange={(e) => setGalleryCaption(e.target.value)} className="field" placeholder="Caption" />
              <input value={galleryLocation} onChange={(e) => setGalleryLocation(e.target.value)} className="field" placeholder="Location optional" />
              <div className="grid grid-cols-2 gap-2">
                <input value={galleryLat} onChange={(e) => setGalleryLat(e.target.value)} className="field" placeholder="Lat optional" />
                <input value={galleryLng} onChange={(e) => setGalleryLng(e.target.value)} className="field" placeholder="Lng optional" />
              </div>
              <button type="button" onClick={() => void postDiaryEntry()} className="action-primary">Add Entry</button>
            </article>

            <article className="rounded-2xl border border-white/20 bg-black/20 p-3 lg:p-4">
              <h2 className="text-base font-semibold">Photo Diary</h2>
              {detail.gallery.length === 0 ? (
                <p className="mt-2 text-sm text-white/70">No entries yet.</p>
              ) : (
                <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-3">
                  {detail.gallery.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                      <div className="relative h-40 w-full">
                        <Image src={entry.imageUrl} alt={entry.caption} fill unoptimized sizes="(max-width:1024px) 100vw, 40vw" className="object-cover" />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium">{entry.caption}</p>
                        {entry.location ? <p className="text-xs text-white/65 mt-1">{entry.location}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        ) : null}
      </section>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-full bg-emerald-500 text-white px-4 py-2 text-sm font-medium shadow-lg">{toast}</div>
        </div>
      ) : null}
    </main>
  );
}
