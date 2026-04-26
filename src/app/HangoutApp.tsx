"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type ActivityType = "chill" | "active" | "help";

type Activity = {
  id: string;
  creatorId: string | null;
  creatorName: string;
  title: string;
  description: string | null;
  location: string;
  lat: number | null;
  lng: number | null;
  whenISO: string;
  type: ActivityType;
  going: number;
  limit: number | null;
  createdAt: string;
  joined: boolean;
};

type Badge = {
  id: string;
  label: string;
  description: string;
};

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
    author: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    } | null;
  }>;
  gallery: Array<{
    id: string;
    imageUrl: string;
    caption: string;
    location: string | null;
    lat: number | null;
    lng: number | null;
    createdAt: string;
  }>;
  reviewContext: {
    canSubmitProfileReview: boolean;
    hasProfileReview: boolean;
    eligibleActivities: Array<{
      id: string;
      title: string;
      location: string;
      whenISO: string;
    }>;
    reviewedActivityIds: string[];
  } | null;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

type GoogleMapMouseEvent = {
  latLng?: GoogleLatLng | null;
};

type GoogleLatLngBounds = {
  extend: (pos: { lat: number; lng: number }) => void;
};

type GoogleMap = {
  addListener: (event: string, callback: (event: GoogleMapMouseEvent) => void) => void;
  fitBounds: (bounds: GoogleLatLngBounds) => void;
  getZoom: () => number;
  setZoom: (zoom: number) => void;
  panTo: (pos: { lat: number; lng: number }) => void;
};

type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
  addListener: (event: string, callback: () => void) => void;
};

type GoogleMapsApi = {
  Map: new (
    el: HTMLElement,
    opts: {
      center: { lat: number; lng: number };
      zoom: number;
      mapTypeControl: boolean;
      streetViewControl: boolean;
      fullscreenControl?: boolean;
    },
  ) => GoogleMap;
  Marker: new (opts: { map: GoogleMap; position: { lat: number; lng: number }; title?: string }) => GoogleMarker;
  LatLngBounds: new () => GoogleLatLngBounds;
};

declare global {
  interface Window {
    google?: {
      maps: GoogleMapsApi;
    };
  }
}

const THEME_KEY = "hangout.theme";

const TYPE_META: Record<ActivityType, { label: string; chip: string }> = {
  chill: { label: "Chill", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" },
  active: { label: "Active", chip: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200" },
  help: { label: "Help", chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" },
};

const HERO_SCENES = [
  {
    src: "/scenes/rooftop-night.svg",
    title: "Evening Rooftop Vibes",
    caption: "Low-pressure social meetups after work.",
  },
  {
    src: "/scenes/city-walk.svg",
    title: "City Walk Energy",
    caption: "Explore local spots and discover new people.",
  },
  {
    src: "/scenes/help-circle.svg",
    title: "Community Help Circle",
    caption: "Organize support and meaningful collaboration.",
  },
] as const;

const TYPE_VISUAL: Record<ActivityType, string> = {
  chill: "/scenes/rooftop-night.svg",
  active: "/scenes/city-walk.svg",
  help: "/scenes/help-circle.svg",
};

let mapsLoader: Promise<GoogleMapsApi | null> | null = null;

function safeText(value: unknown): string {
  return String(value ?? "").trim();
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeInput(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function clampInt(value: string, min: number, max: number): number | null {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getTheme(): "light" | "dark" | "system" {
  const v = localStorage.getItem(THEME_KEY);
  if (v === "light" || v === "dark") return v;
  return "system";
}

function applyTheme() {
  const mode = getTheme();
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "system" && prefersDark));
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    cache: options?.cache ?? "no-store",
    ...options,
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const msg = (data as { error?: string } | null)?.error;
    throw new Error(msg || `Request failed (${response.status})`);
  }
  return data as T;
}

function loadGoogleMaps(): Promise<GoogleMapsApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.resolve(null);
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-hangout-maps="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google?.maps ?? null));
      existing.addEventListener("error", () => reject(new Error("Could not load Google Maps")));
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.hangoutMaps = "1";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.onload = () => resolve(window.google?.maps ?? null);
    script.onerror = () => reject(new Error("Could not load Google Maps"));
    document.head.appendChild(script);
  });

  return mapsLoader;
}

function Avatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl?: string | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${dim} rounded-full object-cover border border-slate-300/70 dark:border-slate-700/70`} />;
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className={`${dim} rounded-full border border-slate-300/70 dark:border-slate-700/70 bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center justify-center`}>
      {initial}
    </div>
  );
}

export default function HangoutApp({
  initialActivities,
  initialBackendOk,
  initialUser,
}: {
  initialActivities: Activity[];
  initialBackendOk: boolean;
  initialUser: User | null;
}) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [backendOk] = useState(initialBackendOk);
  const [user, setUser] = useState<User | null>(initialUser);
  const userId = user?.id ?? null;

  const [tab, setTab] = useState<"map" | "profiles">("map");
  const [mobileMapPane, setMobileMapPane] = useState<"create" | "feed" | "details">("feed");
  const [mobileProfilesPane, setMobileProfilesPane] = useState<"list" | "detail">("list");
  const [toast, setToast] = useState<string | null>(null);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | ActivityType>("all");
  const [sortBy, setSortBy] = useState<"soonest" | "newest">("soonest");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(initialActivities[0]?.id ?? null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [time, setTime] = useState(() => toTimeInput(new Date()));
  const [type, setType] = useState<ActivityType>("chill");
  const [limit, setLimit] = useState("");
  const [pinLat, setPinLat] = useState("");
  const [pinLng, setPinLng] = useState("");

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileDetail, setProfileDetail] = useState<ProfileDetail | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [editName, setEditName] = useState(initialUser?.displayName ?? "");
  const [editBio, setEditBio] = useState(initialUser?.bio ?? "");
  const [editAvatarUrl, setEditAvatarUrl] = useState(initialUser?.avatarUrl ?? "");

  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMode, setReviewMode] = useState<"profile" | "activity">("profile");
  const [reviewActivityId, setReviewActivityId] = useState("");

  const [galleryImageUrl, setGalleryImageUrl] = useState("");
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryLocation, setGalleryLocation] = useState("");
  const [galleryLat, setGalleryLat] = useState("");
  const [galleryLng, setGalleryLng] = useState("");

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const pickerMapElRef = useRef<HTMLDivElement | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const profilesSectionRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const pickerMapRef = useRef<GoogleMap | null>(null);
  const pickerMarkerRef = useRef<GoogleMarker | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const bootProfilesLoadedRef = useRef(false);

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === selectedActivityId) ?? null,
    [activities, selectedActivityId],
  );
  const availableActivityReviewOptions = useMemo(() => {
    if (!profileDetail?.reviewContext) return [];
    const reviewed = new Set(profileDetail.reviewContext.reviewedActivityIds);
    return profileDetail.reviewContext.eligibleActivities.filter((activity) => !reviewed.has(activity.id));
  }, [profileDetail]);

  const filteredActivities = useMemo(() => {
    const q = search.trim().toLowerCase();
    const copy = activities.filter((a) => {
      const hay = `${a.title} ${a.description ?? ""} ${a.location} ${a.creatorName} ${a.type}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (filterType !== "all" && a.type !== filterType) return false;
      if (onlyOpen && a.limit !== null && a.going >= a.limit) return false;
      if (onlyOpen && new Date(a.whenISO).getTime() <= Date.now()) return false;
      return true;
    });
    copy.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(a.whenISO).getTime() - new Date(b.whenISO).getTime();
    });
    return copy;
  }, [activities, search, filterType, onlyOpen, sortBy]);

  useEffect(() => {
    if (!profileDetail?.reviewContext) {
      setReviewMode("profile");
      setReviewActivityId("");
      return;
    }
    if (availableActivityReviewOptions.length > 0) {
      setReviewActivityId((prev) => (prev && availableActivityReviewOptions.some((a) => a.id === prev) ? prev : availableActivityReviewOptions[0].id));
    } else {
      setReviewActivityId("");
    }
    if (!profileDetail.reviewContext.canSubmitProfileReview && availableActivityReviewOptions.length > 0) {
      setReviewMode("activity");
    }
  }, [profileDetail, availableActivityReviewOptions]);

  useEffect(() => {
    applyTheme();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiFetch<{ user: User | null }>("/api/auth/me", { cache: "no-store" });
        if (!me.user) return;
        const meUser = me.user;
        setUser((prev) => prev ?? meUser);
        setEditName((prev) => (prev ? prev : meUser.displayName));
        setEditBio((prev) => (prev ? prev : meUser.bio ?? ""));
        setEditAvatarUrl((prev) => (prev ? prev : meUser.avatarUrl ?? ""));
      } catch {
        // Keep existing local auth state on transient failure.
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    const authSuccess = params.get("auth_success");
    if (!authError && !authSuccess) return;
    if (authSuccess === "google") {
      setToast("Google login successful.");
    } else if (authError) {
      setToast(`Google login failed: ${authError.replaceAll("_", " ")}`);
    }
    params.delete("auth_error");
    params.delete("auth_success");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    if (tab !== "map") return;
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    window.setTimeout(() => {
      const mapsWithEvent = window.google?.maps as unknown as { event?: { trigger?: (target: GoogleMap, eventName: string) => void } };
      mapsWithEvent.event?.trigger?.(map, "resize");
      if (selectedActivity && typeof selectedActivity.lat === "number" && typeof selectedActivity.lng === "number") {
        map.panTo({ lat: selectedActivity.lat, lng: selectedActivity.lng });
      }
    }, 120);
  }, [tab, selectedActivity]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (bootProfilesLoadedRef.current) return;
    bootProfilesLoadedRef.current = true;
    void (async () => {
      try {
        const rows = await apiFetch<ProfileSummary[]>("/api/profiles");
        setProfiles(rows);
        if (!selectedProfileId && rows[0]) {
          const preferred = user ? rows.find((r) => r.id === user.id) ?? rows[0] : rows[0];
          setSelectedProfileId(preferred.id);
        }
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Could not load profiles");
      }
    })();
  }, [selectedProfileId, user]);

  useEffect(() => {
    const target = selectedProfileId ?? user?.id ?? null;
    if (!target) return;
    void loadProfile(target).catch(() => {});
  }, [selectedProfileId, user?.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const maps = await loadGoogleMaps();
      if (!maps || cancelled) return;

      if (!mapRef.current && mapElRef.current) {
        mapRef.current = new maps.Map(mapElRef.current, {
          center: { lat: 24.7136, lng: 46.6753 },
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
      }

      if (!pickerMapRef.current && pickerMapElRef.current) {
        pickerMapRef.current = new maps.Map(pickerMapElRef.current, {
          center: { lat: 24.7136, lng: 46.6753 },
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        pickerMapRef.current.addListener("click", (e) => {
          const lat = e.latLng?.lat?.();
          const lng = e.latLng?.lng?.();
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const latNum = lat as number;
          const lngNum = lng as number;
          setPinLat(latNum.toFixed(6));
          setPinLng(lngNum.toFixed(6));
          if (pickerMarkerRef.current) pickerMarkerRef.current.setMap(null);
          pickerMarkerRef.current = new maps.Marker({
            map: pickerMapRef.current as GoogleMap,
            position: { lat: latNum, lng: lngNum },
          });
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const maps = window.google?.maps;
    if (!maps || !mapRef.current) return;
    for (const marker of markersRef.current) marker.setMap(null);
    markersRef.current = [];
    const bounds = new maps.LatLngBounds();
    let hasPins = false;
    for (const item of filteredActivities) {
      if (typeof item.lat !== "number" || typeof item.lng !== "number") continue;
      const marker = new maps.Marker({
        map: mapRef.current,
        position: { lat: item.lat, lng: item.lng },
        title: item.title,
      });
      marker.addListener("click", () => setSelectedActivityId(item.id));
      markersRef.current.push(marker);
      bounds.extend({ lat: item.lat, lng: item.lng });
      hasPins = true;
    }
    if (hasPins) {
      mapRef.current.fitBounds(bounds);
      if (mapRef.current.getZoom() > 14) mapRef.current.setZoom(14);
    }
  }, [filteredActivities]);

  useEffect(() => {
    if (!selectedActivity || !mapRef.current) return;
    if (typeof selectedActivity.lat !== "number" || typeof selectedActivity.lng !== "number") return;
    mapRef.current.panTo({ lat: selectedActivity.lat, lng: selectedActivity.lng });
  }, [selectedActivity]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPromptEvent(null);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    const pullLatest = () => {
      void (async () => {
        try {
          const me = await apiFetch<{ user: User | null }>("/api/auth/me", { cache: "no-store" });
          if (!me.user) return;
          setUser((prev) => prev ?? me.user);
        } catch {
          // Keep current auth state if check fails.
        }
      })();

      void (async () => {
        try {
          const rows = await apiFetch<Activity[]>("/api/activities");
          setActivities(rows);
          setSelectedActivityId((prev) => prev ?? rows[0]?.id ?? null);
        } catch {
          // Silent background refresh.
        }
      })();

      void (async () => {
        try {
          const rows = await apiFetch<ProfileSummary[]>("/api/profiles");
          setProfiles(rows);
          setSelectedProfileId((prev) => {
            if (prev) return prev;
            if (!rows[0]) return null;
            return userId ? rows.find((r) => r.id === userId)?.id ?? rows[0].id : rows[0].id;
          });
        } catch {
          // Silent background refresh.
        }
      })();

      const target = selectedProfileId ?? userId;
      if (!target) return;
      void (async () => {
        try {
          const detail = await apiFetch<ProfileDetail>(`/api/profiles/${target}`);
          setProfileDetail(detail);
        } catch {
          // Silent background refresh.
        }
      })();
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      pullLatest();
    }, 10000);

    const onFocusOrVisible = () => {
      if (document.visibilityState !== "visible") return;
      pullLatest();
    };

    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [selectedProfileId, userId]);

  async function refreshActivities(options?: { silent?: boolean }) {
    try {
      const rows = await apiFetch<Activity[]>("/api/activities");
      setActivities(rows);
      if (!selectedActivityId && rows.length > 0) setSelectedActivityId(rows[0].id);
    } catch (error) {
      if (!options?.silent) {
        setToast(error instanceof Error ? error.message : "Could not refresh activities");
      }
      throw error;
    }
  }

  async function refreshProfiles(options?: { silent?: boolean }) {
    try {
      const rows = await apiFetch<ProfileSummary[]>("/api/profiles");
      setProfiles(rows);
      if (!selectedProfileId && rows[0]) {
        const preferred = user ? rows.find((r) => r.id === user.id) ?? rows[0] : rows[0];
        setSelectedProfileId(preferred.id);
      }
    } catch (error) {
      if (!options?.silent) {
        setToast(error instanceof Error ? error.message : "Could not load profiles");
      }
      throw error;
    }
  }

  async function loadProfile(id: string, options?: { silent?: boolean }) {
    try {
      setLoadingProfile(true);
      const detail = await apiFetch<ProfileDetail>(`/api/profiles/${id}`);
      setProfileDetail(detail);
    } catch (error) {
      if (!options?.silent) {
        setToast(error instanceof Error ? error.message : "Could not load profile");
      }
      throw error;
    } finally {
      setLoadingProfile(false);
    }
  }

  function resetCreateForm() {
    const now = new Date();
    setTitle("");
    setDescription("");
    setLocation("");
    setDate(toDateInput(now));
    setTime(toTimeInput(now));
    setType("chill");
    setLimit("");
    setPinLat("");
    setPinLng("");
    if (pickerMarkerRef.current) {
      pickerMarkerRef.current.setMap(null);
      pickerMarkerRef.current = null;
    }
  }

  async function handleAuthSubmit() {
    const email = safeText(authEmail).toLowerCase();
    const password = safeText(authPassword);
    const displayName = safeText(authName);
    if (!email || !password || (authMode === "signup" && !displayName)) {
      setToast("Fill in the required auth fields.");
      return;
    }
    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body = authMode === "signup" ? { email, password, displayName } : { email, password };
      const result = await apiFetch<{ user: User }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setUser(result.user);
      setEditName(result.user.displayName);
      setEditBio(result.user.bio ?? "");
      setEditAvatarUrl(result.user.avatarUrl ?? "");
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
      setToast(authMode === "signup" ? "Account created." : "Logged in.");
      await refreshActivities();
      await refreshProfiles();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Auth failed");
    }
  }

  function startGoogleLogin() {
    window.location.href = "/api/auth/google/start";
  }

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setEditName("");
      setEditBio("");
      setEditAvatarUrl("");
      setToast("Logged out.");
      await refreshActivities();
      await refreshProfiles();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not logout");
    }
  }

  async function createActivity() {
    if (!backendOk) {
      setToast("Backend not reachable.");
      return;
    }
    if (!user) {
      setToast("Login is required to post.");
      return;
    }
    const t = safeText(title);
    const d = safeText(description);
    const l = safeText(location);
    const lat = Number.parseFloat(pinLat);
    const lng = Number.parseFloat(pinLng);
    if (!t || !l || !date || !time || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setToast("Fill title, location, date/time and pick a map pin.");
      return;
    }
    const when = new Date(`${date}T${time}:00`);
    if (Number.isNaN(when.getTime())) {
      setToast("Invalid date/time.");
      return;
    }
    const limitNum = limit.trim() ? clampInt(limit.trim(), 2, 200) : null;

    try {
      const created = await apiFetch<Activity>("/api/activities", {
        method: "POST",
        body: JSON.stringify({
          title: t,
          description: d || null,
          location: l,
          lat,
          lng,
          whenISO: when.toISOString(),
          type,
          limit: limitNum,
        }),
      });
      setActivities((prev) => [created, ...prev]);
      setSelectedActivityId(created.id);
      setToast("Activity posted.");
      resetCreateForm();
      await refreshProfiles();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not post activity");
    }
  }

  async function joinActivity(activityId: string) {
    if (!user) {
      setToast("Login is required to join.");
      return;
    }
    try {
      const updated = await apiFetch<Activity>(`/api/activities/${activityId}/join`, { method: "POST" });
      setActivities((prev) => prev.map((a) => (a.id === activityId ? { ...a, ...updated, joined: true } : a)));
      setToast("Joined.");
      await refreshProfiles();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not join");
    }
  }

  async function leaveActivity(activityId: string) {
    if (!user) {
      setToast("Login is required to leave.");
      return;
    }
    try {
      const updated = await apiFetch<Activity>(`/api/activities/${activityId}/leave`, { method: "POST" });
      setActivities((prev) => prev.map((a) => (a.id === activityId ? { ...a, ...updated, joined: false } : a)));
      setToast("Left activity.");
      await refreshProfiles();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not leave");
    }
  }

  async function deleteActivity(activityId: string) {
    const target = activities.find((a) => a.id === activityId);
    if (!target) return;
    if (!window.confirm(`Delete "${target.title}"?`)) return;
    try {
      await apiFetch(`/api/activities/${activityId}`, { method: "DELETE" });
      setActivities((prev) => prev.filter((a) => a.id !== activityId));
      if (selectedActivityId === activityId) setSelectedActivityId(null);
      setToast("Deleted.");
      await refreshProfiles();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not delete");
    }
  }

  async function saveProfile() {
    if (!user) return;
    const displayName = safeText(editName);
    if (!displayName) {
      setToast("Display name is required.");
      return;
    }
    if (editAvatarUrl && !isValidImageUrl(editAvatarUrl)) {
      setToast("Avatar URL must be http/https.");
      return;
    }
    try {
      const updated = await apiFetch<User>(`/api/profiles/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName,
          bio: editBio,
          avatarUrl: editAvatarUrl,
        }),
      });
      setUser(updated);
      setEditName(updated.displayName);
      setEditBio(updated.bio ?? "");
      setEditAvatarUrl(updated.avatarUrl ?? "");
      setToast("Profile updated.");
      await refreshProfiles();
      await loadProfile(updated.id);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not update profile");
    }
  }

  async function postReview() {
    if (!user || !profileDetail || profileDetail.profile.id === user.id) return;
    const rating = clampInt(reviewRating, 1, 5);
    const comment = safeText(reviewComment);
    if (!rating || !comment) {
      setToast("Rating and comment are required.");
      return;
    }
    if (reviewMode === "profile" && !profileDetail.reviewContext?.canSubmitProfileReview) {
      setToast("Profile review is not available.");
      return;
    }
    if (reviewMode === "activity" && !reviewActivityId) {
      setToast("Choose a shared activity first.");
      return;
    }
    try {
      await apiFetch(`/api/profiles/${profileDetail.profile.id}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          rating,
          comment,
          reviewType: reviewMode,
          activityId: reviewMode === "activity" ? reviewActivityId : null,
        }),
      });
      setReviewComment("");
      setReviewRating("5");
      setToast("Review posted.");
      await loadProfile(profileDetail.profile.id);
      await refreshProfiles();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not post review");
    }
  }

  async function postGalleryEntry() {
    if (!user || !profileDetail || profileDetail.profile.id !== user.id) return;
    const imageUrl = safeText(galleryImageUrl);
    const caption = safeText(galleryCaption);
    const locationValue = safeText(galleryLocation);
    const lat = galleryLat.trim() ? Number.parseFloat(galleryLat) : null;
    const lng = galleryLng.trim() ? Number.parseFloat(galleryLng) : null;

    if (!imageUrl || !caption) {
      setToast("Image URL and caption are required.");
      return;
    }
    if (!isValidImageUrl(imageUrl)) {
      setToast("Image URL must be http/https.");
      return;
    }
    if ((lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) {
      setToast("Coordinates must be valid numbers.");
      return;
    }

    try {
      await apiFetch(`/api/profiles/${user.id}/gallery`, {
        method: "POST",
        body: JSON.stringify({
          imageUrl,
          caption,
          location: locationValue || null,
          lat,
          lng,
        }),
      });
      setGalleryImageUrl("");
      setGalleryCaption("");
      setGalleryLocation("");
      setGalleryLat("");
      setGalleryLng("");
      setToast("Diary entry added.");
      await loadProfile(user.id);
      await refreshProfiles();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not add diary entry");
    }
  }

  function cycleTheme() {
    const current = getTheme();
    const next = current === "dark" ? "light" : current === "light" ? "system" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme();
    setToast(`Theme: ${next}`);
  }

  async function installApp() {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  }

  const mapEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const isOwnSelectedActivity = !!(selectedActivity && user?.id && selectedActivity.creatorId === user.id);

  function switchTab(nextTab: "map" | "profiles") {
    setTab(nextTab);
    if (nextTab === "map") setMobileMapPane("feed");
    if (nextTab === "profiles") setMobileProfilesPane("list");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = nextTab === "map" ? mapSectionRef.current : profilesSectionRef.current;
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function isMobileViewport(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  }

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 safe-top border-b border-slate-300/40 dark:border-slate-700/60 bg-white/70 dark:bg-slate-950/65 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 data-heading="true" className="text-2xl font-semibold tracking-tight truncate">Hangout Map</h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 truncate">Your city feels better when people show up for each other.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {installPromptEvent ? (
                <button type="button" onClick={() => void installApp()} className="hidden sm:inline-flex h-9 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900 text-sm font-medium">
                  Install App
                </button>
              ) : null}
              <button type="button" onClick={cycleTheme} className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-300/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"></path>
                </svg>
              </button>
              {user ? (
                <button type="button" onClick={() => void logout()} className="h-9 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900 text-sm font-medium">
                  Logout
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 safe-bottom fade-up">
        <div className="hidden sm:flex items-center gap-2 mb-4">
          <button type="button" onClick={() => switchTab("map")} className={`h-10 px-4 rounded-md text-sm font-medium border ${tab === "map" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900"}`}>
            Map + Posts
          </button>
          <button type="button" onClick={() => switchTab("profiles")} className={`h-10 px-4 rounded-md text-sm font-medium border ${tab === "profiles" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900"}`}>
            Profiles
          </button>
        </div>

        <section className="hidden sm:block mb-5 rounded-2xl card-surface p-4 sm:p-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 data-heading="true" className="text-xl sm:text-2xl font-semibold">Find your next plan in minutes</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Real activities, real people, and now a warmer visual experience.</p>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Browse, post, and join directly from the map.</p>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {HERO_SCENES.map((scene) => (
              <article key={scene.src} className="hero-image border border-slate-200/70 dark:border-slate-700/70">
                <Image src={scene.src} alt={scene.title} width={1200} height={800} className="h-44 sm:h-40 w-full object-cover" priority={scene.src === HERO_SCENES[0].src} />
                <div className="absolute inset-x-0 bottom-0 z-10 p-3 text-white">
                  <p data-heading="true" className="text-sm font-semibold">{scene.title}</p>
                  <p className="text-xs opacity-90">{scene.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {!backendOk ? (
          <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Backend is not reachable. Check `DATABASE_URL`.
          </div>
        ) : null}

        {!user ? (
          <section className="mb-5 rounded-xl card-surface p-4 sm:p-5">
            <h2 className="text-base font-semibold">Sign in to join, post, and review</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Joining activities requires an account. Use Google for one-tap onboarding, or email login.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={startGoogleLogin}
                className="h-11 px-4 rounded-md border border-slate-300/70 dark:border-slate-700 bg-white/95 dark:bg-slate-900 text-sm font-semibold inline-flex items-center gap-2"
              >
                <span className="text-base leading-none">G</span>
                Continue with Google
              </button>
            </div>
            <div className="mt-4 border-t border-slate-200/70 dark:border-slate-700/70 pt-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Or use email</p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => setAuthMode("login")} className={`h-9 px-3 rounded-md border text-sm ${authMode === "login" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700"}`}>
                Login
              </button>
              <button type="button" onClick={() => setAuthMode("signup")} className={`h-9 px-3 rounded-md border text-sm ${authMode === "signup" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700"}`}>
                Signup
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
              {authMode === "signup" ? (
                <input value={authName} onChange={(e) => setAuthName(e.target.value)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Display name" />
              ) : null}
              <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Email" />
              <input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} type="password" className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Password" />
              <button type="button" onClick={() => void handleAuthSubmit()} className="h-10 px-3 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-medium">
                {authMode === "signup" ? "Create Account" : "Login"}
              </button>
            </div>
          </section>
        ) : (
          <section className="mb-5 rounded-xl card-surface p-4">
            <div className="flex items-center gap-3">
              <Avatar name={user.displayName} avatarUrl={user.avatarUrl} />
              <div>
                <p className="text-sm font-semibold">{user.displayName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">{user.email}</p>
              </div>
            </div>
          </section>
        )}

        <div className={tab === "map" ? "" : "hidden"} aria-hidden={tab !== "map"}>
          <div ref={mapSectionRef} className="grid grid-cols-1 xl:grid-cols-[340px_1fr_320px] gap-4">
            <section className="sm:hidden rounded-xl card-surface p-2.5">
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setMobileMapPane("create")} className={`h-9 rounded-md text-xs font-medium border ${mobileMapPane === "create" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700"}`}>Create</button>
                <button type="button" onClick={() => setMobileMapPane("feed")} className={`h-9 rounded-md text-xs font-medium border ${mobileMapPane === "feed" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700"}`}>Feed</button>
                <button type="button" onClick={() => setMobileMapPane("details")} className={`h-9 rounded-md text-xs font-medium border ${mobileMapPane === "details" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700"}`}>Details</button>
              </div>
            </section>

            <section className={`rounded-xl card-surface p-4 ${mobileMapPane !== "create" ? "hidden sm:block" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Create Post</h2>
                <button type="button" onClick={resetCreateForm} className="text-xs text-slate-600 dark:text-slate-300">
                  Reset
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Task or meetup title" />
                <input value={location} onChange={(e) => setLocation(e.target.value)} className="h-10 w-full px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Location name" />
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full min-h-24 px-3 py-2 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Details" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" />
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select value={type} onChange={(e) => setType(e.target.value as ActivityType)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent">
                    <option value="chill">Chill</option>
                    <option value="active">Active</option>
                    <option value="help">Help</option>
                  </select>
                  <input value={limit} onChange={(e) => setLimit(e.target.value)} type="number" min={2} max={200} placeholder="Limit optional" className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={pinLat} onChange={(e) => setPinLat(e.target.value)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Latitude" />
                  <input value={pinLng} onChange={(e) => setPinLng(e.target.value)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Longitude" />
                </div>
                <div className="rounded-lg border border-slate-300/70 dark:border-slate-700 overflow-hidden">
                  {mapEnabled ? (
                    <div ref={pickerMapElRef} className="h-44 w-full" />
                  ) : (
                    <div className="h-44 w-full p-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">
                      Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for map pin picking.
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => void createActivity()} className="h-10 w-full rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium text-sm">
                  Post Activity
                </button>
              </div>
            </section>

            <section className={`rounded-xl card-surface overflow-hidden ${mobileMapPane !== "feed" ? "hidden sm:block" : ""}`}>
              <div className="p-4 border-b border-slate-300/60 dark:border-slate-700/70">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} type="search" placeholder="Search posts, location, host" className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent text-sm" />
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value as "all" | ActivityType)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent text-sm">
                    <option value="all">All</option>
                    <option value="chill">Chill</option>
                    <option value="active">Active</option>
                    <option value="help">Help</option>
                  </select>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "soonest" | "newest")} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent text-sm">
                    <option value="soonest">Soonest</option>
                    <option value="newest">Newest</option>
                  </select>
                  <label className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 text-sm flex items-center gap-2">
                    <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
                    Open
                  </label>
                </div>
              </div>

              <div className="border-b border-slate-300/60 dark:border-slate-700/70">
                {mapEnabled ? (
                  <div ref={mapElRef} className="h-[260px] sm:h-[360px] w-full" />
                ) : (
                  <div className="h-[260px] sm:h-[360px] w-full p-4 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">
                    Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to show the live map.
                  </div>
                )}
              </div>

              <div className="max-h-[420px] sm:max-h-[520px] overflow-auto divide-y divide-slate-300/60 dark:divide-slate-700/70">
                {filteredActivities.length === 0 ? (
                  <div className="p-6 text-sm text-slate-600 dark:text-slate-300">No posts found.</div>
                ) : (
                  filteredActivities.map((item) => {
                    const isFull = item.limit !== null && item.going >= item.limit;
                    const isClosed = new Date(item.whenISO).getTime() <= Date.now();
                    const selected = selectedActivityId === item.id;
                    const isMine = !!(user?.id && item.creatorId === user.id);
                    return (
                      <article
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedActivityId(item.id);
                          if (isMobileViewport()) setMobileMapPane("details");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedActivityId(item.id);
                          }
                        }}
                        className={`p-3 sm:p-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 ${
                          isClosed
                            ? selected
                              ? "bg-rose-100/85 dark:bg-rose-950/35 border-l-4 border-rose-500"
                              : "bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-100/70 dark:hover:bg-rose-950/30 border-l-4 border-rose-400/70"
                            : selected
                              ? "bg-slate-100/80 dark:bg-slate-800/70"
                              : "hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 hidden sm:block overflow-hidden rounded-lg border border-slate-200/70 dark:border-slate-700/70">
                              <Image src={TYPE_VISUAL[item.type]} alt={`${TYPE_META[item.type].label} activity mood`} width={1200} height={800} className="h-20 w-full object-cover" />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex h-6 items-center rounded-md px-2 text-xs font-medium ${TYPE_META[item.type].chip}`}>{TYPE_META[item.type].label}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-300">Host: {item.creatorName}</span>
                              {isClosed ? <span className="inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">Closed</span> : null}
                            </div>
                            <h3 className="mt-1 text-sm sm:text-base font-semibold break-words">{item.title}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-300">{item.location} • {formatWhen(item.whenISO)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-300">Going {item.going}{item.limit ? `/${item.limit}` : ""}</p>
                            {item.description ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">{item.description}</p> : null}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 sm:self-start">
                            {item.joined ? (
                              <button type="button" onClick={(e) => { e.stopPropagation(); void leaveActivity(item.id); }} className="h-8 sm:h-9 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 text-xs sm:text-sm">
                                Leave
                              </button>
                            ) : !user ? (
                              <button type="button" disabled className="h-8 sm:h-9 px-3 rounded-md text-xs sm:text-sm font-medium opacity-70 cursor-not-allowed border border-slate-300/70 dark:border-slate-700">
                                Login to Join
                              </button>
                            ) : (
                              <button type="button" disabled={isFull || isClosed} onClick={(e) => { e.stopPropagation(); void joinActivity(item.id); }} className={`h-8 sm:h-9 px-3 rounded-md text-xs sm:text-sm font-medium ${isFull || isClosed ? "opacity-50 cursor-not-allowed border border-slate-300/70 dark:border-slate-700" : "bg-slate-900 text-white dark:bg-white dark:text-slate-900"}`}>
                                {isClosed ? "Closed" : isFull ? "Full" : "Join"}
                              </button>
                            )}
                            {isMine ? (
                              <button type="button" onClick={(e) => { e.stopPropagation(); void deleteActivity(item.id); }} className="h-8 sm:h-9 px-3 rounded-md border border-rose-300/70 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm">
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <section className={`rounded-xl card-surface p-4 ${mobileMapPane !== "details" ? "hidden sm:block" : ""}`}>
              <h2 className="text-sm font-semibold">Post Details</h2>
              {!selectedActivity ? (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Select a post from the map feed.</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  {new Date(selectedActivity.whenISO).getTime() <= Date.now() ? (
                    <p className="inline-flex rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 px-2 py-1 text-xs font-semibold border border-rose-300/60 dark:border-rose-700/60">
                      Closed
                    </p>
                  ) : null}
                  <div className="overflow-hidden rounded-lg border border-slate-200/70 dark:border-slate-700/70">
                    <Image src={TYPE_VISUAL[selectedActivity.type]} alt={`${TYPE_META[selectedActivity.type].label} activity visual`} width={1200} height={800} className="h-44 w-full object-cover" />
                  </div>
                  <h3 className="text-base font-semibold">{selectedActivity.title}</h3>
                  <div className="grid grid-cols-[66px_1fr] gap-y-1 text-xs sm:text-sm">
                    <p className="text-slate-500 dark:text-slate-400">Host</p><p>{selectedActivity.creatorName}</p>
                    <p className="text-slate-500 dark:text-slate-400">Where</p><p>{selectedActivity.location}</p>
                    <p className="text-slate-500 dark:text-slate-400">When</p><p>{formatWhen(selectedActivity.whenISO)}</p>
                    <p className="text-slate-500 dark:text-slate-400">Going</p><p>{selectedActivity.going}{selectedActivity.limit ? `/${selectedActivity.limit}` : ""}</p>
                  </div>
                  {selectedActivity.lat !== null && selectedActivity.lng !== null ? (
                    <p className="text-slate-500 dark:text-slate-300 text-xs">Coords: {selectedActivity.lat.toFixed(5)}, {selectedActivity.lng.toFixed(5)}</p>
                  ) : null}
                  {selectedActivity.description ? <p className="text-slate-600 dark:text-slate-300 rounded-md bg-slate-100/70 dark:bg-slate-800/40 p-2">{selectedActivity.description}</p> : null}
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    {selectedActivity.joined ? (
                      <button type="button" onClick={() => void leaveActivity(selectedActivity.id)} className="h-10 px-4 rounded-md border border-slate-300/70 dark:border-slate-700 text-sm font-medium">
                        Leave Activity
                      </button>
                    ) : !user ? (
                      <button type="button" disabled className="h-10 px-4 rounded-md border border-slate-300/70 dark:border-slate-700 text-sm font-medium opacity-70 cursor-not-allowed">
                        Login to Join
                      </button>
                    ) : new Date(selectedActivity.whenISO).getTime() <= Date.now() ? (
                      <button type="button" disabled className="h-10 px-4 rounded-md border border-slate-300/70 dark:border-slate-700 text-sm font-medium opacity-70 cursor-not-allowed">
                        Closed
                      </button>
                    ) : (
                      <button type="button" onClick={() => void joinActivity(selectedActivity.id)} className="h-10 px-4 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-medium">
                        Join Activity
                      </button>
                    )}
                    {isOwnSelectedActivity ? (
                      <button type="button" onClick={() => void deleteActivity(selectedActivity.id)} className="h-10 px-4 rounded-md border border-rose-300/70 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
        <div className={tab === "profiles" ? "" : "hidden"} aria-hidden={tab !== "profiles"}>
          <div ref={profilesSectionRef} className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
            <section className="sm:hidden rounded-xl card-surface p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMobileProfilesPane("list")} className={`h-9 rounded-md text-xs font-medium border ${mobileProfilesPane === "list" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700"}`}>People</button>
                <button type="button" onClick={() => setMobileProfilesPane("detail")} className={`h-9 rounded-md text-xs font-medium border ${mobileProfilesPane === "detail" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700"}`}>Profile</button>
              </div>
            </section>

            <section className={`rounded-xl card-surface p-4 ${mobileProfilesPane !== "list" ? "hidden sm:block" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Community</h2>
                <button type="button" onClick={() => void refreshProfiles()} className="text-xs text-slate-600 dark:text-slate-300">
                  Refresh
                </button>
              </div>
              <div className="mt-3 space-y-2 max-h-[760px] overflow-auto">
                {profiles.map((profile) => (
                  <button key={profile.id} type="button" onClick={() => { setSelectedProfileId(profile.id); if (isMobileViewport()) setMobileProfilesPane("detail"); }} className={`w-full text-left p-3 rounded-md border ${selectedProfileId === profile.id ? "border-slate-900 dark:border-white" : "border-slate-300/70 dark:border-slate-700"} hover:bg-slate-100/50 dark:hover:bg-slate-800/40`}>
                    <div className="flex items-center gap-2">
                      <Avatar name={profile.displayName} avatarUrl={profile.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{profile.displayName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-300 truncate">
                          {profile.avgRating !== null ? `${profile.avgRating.toFixed(1)} stars` : "No rating"} • {profile.reviewCount} reviews
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.badges.slice(0, 3).map((badge) => (
                        <span key={badge.id} className="text-[11px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className={`rounded-xl card-surface p-4 ${mobileProfilesPane !== "detail" ? "hidden sm:block" : ""}`}>
              {loadingProfile ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">Loading profile...</p>
              ) : !profileDetail ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">Select a profile.</p>
              ) : (
                <div className="space-y-5">
                  <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                    <Image
                      src={TYPE_VISUAL[(profileDetail.stats.createdCount >= profileDetail.stats.joinedCount ? "active" : "chill") as ActivityType]}
                      alt="Profile banner"
                      width={1200}
                      height={800}
                      className="h-44 w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar name={profileDetail.profile.displayName} avatarUrl={profileDetail.profile.avatarUrl} />
                    <div>
                      <h2 className="text-base font-semibold">{profileDetail.profile.displayName}</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{profileDetail.profile.bio || "No bio yet."}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="rounded-md border border-slate-300/70 dark:border-slate-700 p-2"><p className="text-xs text-slate-500">Created</p><p className="font-semibold">{profileDetail.stats.createdCount}</p></div>
                    <div className="rounded-md border border-slate-300/70 dark:border-slate-700 p-2"><p className="text-xs text-slate-500">Joined</p><p className="font-semibold">{profileDetail.stats.joinedCount}</p></div>
                    <div className="rounded-md border border-slate-300/70 dark:border-slate-700 p-2"><p className="text-xs text-slate-500">Diary</p><p className="font-semibold">{profileDetail.stats.diaryCount}</p></div>
                    <div className="rounded-md border border-slate-300/70 dark:border-slate-700 p-2"><p className="text-xs text-slate-500">Reviews</p><p className="font-semibold">{profileDetail.stats.reviewCount}</p></div>
                    <div className="rounded-md border border-slate-300/70 dark:border-slate-700 p-2"><p className="text-xs text-slate-500">Rating</p><p className="font-semibold">{profileDetail.stats.avgRating ?? "-"}</p></div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {profileDetail.stats.badges.map((badge) => (
                      <span key={badge.id} title={badge.description} className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  {user && profileDetail.profile.id === user.id ? (
                    <section className="rounded-lg border border-slate-300/70 dark:border-slate-700 p-3 space-y-3">
                      <h3 className="text-sm font-semibold">Edit profile</h3>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 w-full px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Display name" />
                      <input value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} className="h-10 w-full px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Avatar URL" />
                      <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full min-h-20 px-3 py-2 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Bio" />
                      <button type="button" onClick={() => void saveProfile()} className="h-10 px-4 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-medium">
                        Save Profile
                      </button>
                    </section>
                  ) : null}

                  {!user ? (
                    <section className="rounded-lg border border-slate-300/70 dark:border-slate-700 p-3 space-y-2">
                      <h3 className="text-sm font-semibold">Reviews require an account</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">Join an activity together first, then review this profile or a specific shared activity.</p>
                      <button type="button" onClick={startGoogleLogin} className="h-10 px-4 rounded-md border border-slate-300/70 dark:border-slate-700 bg-white/95 dark:bg-slate-900 text-sm font-medium">
                        Continue with Google
                      </button>
                    </section>
                  ) : null}

                  {user && profileDetail.profile.id !== user.id ? (
                    <section className="rounded-lg border border-slate-300/70 dark:border-slate-700 p-3 space-y-3">
                      <h3 className="text-sm font-semibold">Write review</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={!profileDetail.reviewContext?.canSubmitProfileReview}
                          onClick={() => setReviewMode("profile")}
                          className={`h-9 px-3 rounded-md border text-sm ${reviewMode === "profile" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700"} ${!profileDetail.reviewContext?.canSubmitProfileReview ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          Whole Profile
                        </button>
                        <button
                          type="button"
                          disabled={availableActivityReviewOptions.length === 0}
                          onClick={() => setReviewMode("activity")}
                          className={`h-9 px-3 rounded-md border text-sm ${reviewMode === "activity" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700"} ${availableActivityReviewOptions.length === 0 ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          Specific Activity
                        </button>
                      </div>
                      {reviewMode === "profile" ? (
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {profileDetail.reviewContext?.canSubmitProfileReview
                            ? "This posts one overall profile review."
                            : profileDetail.reviewContext?.hasProfileReview
                              ? "You already posted a profile review."
                              : "Profile review unlocks after you join at least one activity together."}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <select
                            value={reviewActivityId}
                            onChange={(e) => setReviewActivityId(e.target.value)}
                            disabled={availableActivityReviewOptions.length === 0}
                            className="h-10 w-full px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent text-sm disabled:opacity-60"
                          >
                            {availableActivityReviewOptions.length === 0 ? (
                              <option value="">No shared activities available</option>
                            ) : null}
                            {availableActivityReviewOptions.map((activity) => (
                              <option key={activity.id} value={activity.id}>
                                {activity.title} - {activity.location}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-slate-600 dark:text-slate-300">Only people who joined the same activity can post this review.</p>
                        </div>
                      )}
                      <div className="grid grid-cols-[120px_1fr] gap-2">
                        <select value={reviewRating} onChange={(e) => setReviewRating(e.target.value)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent">
                          <option value="5">5 stars</option>
                          <option value="4">4 stars</option>
                          <option value="3">3 stars</option>
                          <option value="2">2 stars</option>
                          <option value="1">1 star</option>
                        </select>
                        <input value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Your comment" />
                      </div>
                      <button
                        type="button"
                        onClick={() => void postReview()}
                        disabled={reviewMode === "profile" ? !profileDetail.reviewContext?.canSubmitProfileReview : availableActivityReviewOptions.length === 0}
                        className="h-10 px-4 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Post Review
                      </button>
                    </section>
                  ) : null}

                  {user && profileDetail.profile.id === user.id ? (
                    <section className="rounded-lg border border-slate-300/70 dark:border-slate-700 p-3 space-y-3">
                      <h3 className="text-sm font-semibold">Add diary entry</h3>
                      <input value={galleryImageUrl} onChange={(e) => setGalleryImageUrl(e.target.value)} className="h-10 w-full px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Image URL" />
                      <input value={galleryCaption} onChange={(e) => setGalleryCaption(e.target.value)} className="h-10 w-full px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Caption" />
                      <input value={galleryLocation} onChange={(e) => setGalleryLocation(e.target.value)} className="h-10 w-full px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Location text optional" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={galleryLat} onChange={(e) => setGalleryLat(e.target.value)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Lat optional" />
                        <input value={galleryLng} onChange={(e) => setGalleryLng(e.target.value)} className="h-10 px-3 rounded-md border border-slate-300/70 dark:border-slate-700 bg-transparent" placeholder="Lng optional" />
                      </div>
                      <button type="button" onClick={() => void postGalleryEntry()} className="h-10 px-4 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-medium">
                        Add Diary Entry
                      </button>
                    </section>
                  ) : null}

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Reviews</h3>
                    {profileDetail.reviews.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">No reviews yet.</p>
                    ) : (
                      profileDetail.reviews.map((review) => (
                        <article key={review.id} className="rounded-md border border-slate-300/70 dark:border-slate-700 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{review.author?.displayName ?? "User"}</p>
                            <p className="text-xs text-slate-500">{review.rating}/5</p>
                          </div>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {review.reviewType === "activity" ? `Activity review${review.activityTitle ? ` - ${review.activityTitle}` : ""}` : "Whole profile review"}
                          </p>
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{review.comment}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatWhen(review.createdAt)}</p>
                        </article>
                      ))
                    )}
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Photo diary</h3>
                    {profileDetail.gallery.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">No entries yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {profileDetail.gallery.map((entry) => (
                          <article key={entry.id} className="rounded-lg border border-slate-300/70 dark:border-slate-700 overflow-hidden bg-white/60 dark:bg-slate-900/40">
                            <div className="relative">
                              <img src={entry.imageUrl} alt={entry.caption} className="w-full h-44 object-cover bg-slate-100 dark:bg-slate-800" />
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/15 via-transparent to-transparent"></div>
                            </div>
                            <div className="p-3">
                              <p className="text-sm font-medium">{entry.caption}</p>
                              {entry.location ? <p className="mt-1 text-xs text-slate-500">{entry.location}</p> : null}
                              {entry.lat !== null && entry.lng !== null ? <p className="text-xs text-slate-500">{entry.lat.toFixed(5)}, {entry.lng.toFixed(5)}</p> : null}
                              <p className="mt-1 text-xs text-slate-500">{formatWhen(entry.createdAt)}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 safe-bottom border-t border-slate-300/50 dark:border-slate-700 bg-white/88 dark:bg-slate-950/88 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 pt-2 flex items-center gap-2">
          <button type="button" onClick={() => switchTab("map")} className={`h-11 flex-1 rounded-md text-sm font-medium border ${tab === "map" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900"}`}>
            Map
          </button>
          <button type="button" onClick={() => switchTab("profiles")} className={`h-11 flex-1 rounded-md text-sm font-medium border ${tab === "profiles" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent" : "border-slate-300/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900"}`}>
            Profiles
          </button>
          {installPromptEvent ? (
            <button type="button" onClick={() => void installApp()} className="h-11 px-3 rounded-md text-sm font-medium border border-slate-300/70 dark:border-slate-700 bg-white/90 dark:bg-slate-900">
              Install
            </button>
          ) : null}
        </div>
      </nav>

      {toast ? (
        <div className="fixed bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div className="max-w-[92vw] rounded-lg border border-slate-300/70 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 shadow-lg text-sm flex items-center gap-3">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast(null)} className="ml-auto text-slate-500 hover:text-slate-900 dark:hover:text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18"></path>
                <path d="m6 6 12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
