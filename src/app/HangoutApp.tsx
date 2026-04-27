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
  recentActivities: Array<{
    id: string;
    title: string;
    location: string;
    whenISO: string;
    lat: number | null;
    lng: number | null;
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

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type LeafletModule = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;
type LeafletCircleMarker = import("leaflet").CircleMarker;
type LeafletLayerGroup = import("leaflet").LayerGroup;

type ToastTone = "info" | "error";

const TYPE_META: Record<ActivityType, { label: string; accent: string; scene: string }> = {
  chill: { label: "Chill", accent: "var(--type-chill)", scene: "/scenes/rooftop-night.svg" },
  active: { label: "Active", accent: "var(--type-active)", scene: "/scenes/city-walk.svg" },
  help: { label: "Help", accent: "var(--type-help)", scene: "/scenes/help-circle.svg" },
};

let leafletLoader: Promise<LeafletModule> | null = null;

function safeText(value: unknown): string {
  return String(value ?? "").trim();
}

function clampInt(value: string, min: number, max: number): number | null {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
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

function isClosedByWhen(whenISO: string, nowTick: number): boolean {
  if (nowTick <= 0) return false;
  const ts = new Date(whenISO).getTime();
  return Number.isFinite(ts) && ts <= nowTick;
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
  if (!headers.has("Content-Type") && options?.body) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
    cache: options?.cache ?? "no-store",
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

function loadLeaflet(): Promise<LeafletModule> {
  if (!leafletLoader) {
    leafletLoader = import("leaflet");
  }
  return leafletLoader;
}

function isMobileViewport(): boolean {
  return window.matchMedia("(max-width: 1023px)").matches;
}

function Avatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl?: string | null; size?: "sm" | "md" }) {
  const px = size === "sm" ? 32 : 40;
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={px}
        height={px}
        unoptimized
        className={`${dim} rounded-full object-cover border border-white/35`}
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className={`${dim} rounded-full border border-white/35 bg-white/10 grid place-items-center text-xs font-bold`}>
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

  const [activeView, setActiveView] = useState<"map" | "profiles">("map");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);
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
  const [pinSearchQuery, setPinSearchQuery] = useState("");
  const [pinSearchResults, setPinSearchResults] = useState<NominatimResult[]>([]);
  const [pinSearchLoading, setPinSearchLoading] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(initialUser?.id ?? null);
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
  const mapRef = useRef<LeafletMap | null>(null);
  const pickerMapRef = useRef<LeafletMap | null>(null);
  const pickerMarkerRef = useRef<LeafletCircleMarker | null>(null);
  const markersLayerRef = useRef<LeafletLayerGroup | null>(null);
  const bootProfilesLoadedRef = useRef(false);

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === selectedActivityId) ?? null,
    [activities, selectedActivityId],
  );

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = activities.filter((activity) => {
      const haystack = `${activity.title} ${activity.description ?? ""} ${activity.location} ${activity.creatorName}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filterType !== "all" && activity.type !== filterType) return false;
      if (onlyOpen && activity.limit !== null && activity.going >= activity.limit) return false;
      if (onlyOpen && isClosedByWhen(activity.whenISO, nowTick)) return false;
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(a.whenISO).getTime() - new Date(b.whenISO).getTime();
    });

    return list;
  }, [activities, search, filterType, sortBy, onlyOpen, nowTick]);

  const availableActivityReviewOptions = useMemo(() => {
    if (!profileDetail?.reviewContext) return [];
    const reviewed = new Set(profileDetail.reviewContext.reviewedActivityIds);
    return profileDetail.reviewContext.eligibleActivities.filter((activity) => !reviewed.has(activity.id));
  }, [profileDetail]);

  const upcomingCount = useMemo(
    () => activities.filter((activity) => !isClosedByWhen(activity.whenISO, nowTick)).length,
    [activities, nowTick],
  );

  const openSeatCount = useMemo(
    () => activities.filter((activity) => activity.limit === null || activity.going < activity.limit).length,
    [activities],
  );

  const selectedTypeMeta = selectedActivity ? TYPE_META[selectedActivity.type] : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiFetch<{ user: User | null }>("/api/auth/me", { cache: "no-store" });
        if (!me.user) return;
        setUser((prev) => prev ?? me.user);
      } catch {
        // Keep initial state on transient failures.
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    const authSuccess = params.get("auth_success");
    if (!authError && !authSuccess) return;

    if (authSuccess === "google") {
      window.setTimeout(() => setToast({ tone: "info", message: "Google login successful." }), 0);
    } else if (authError) {
      window.setTimeout(() => setToast({ tone: "error", message: `Google login failed: ${authError.replaceAll("_", " ")}` }), 0);
    }

    params.delete("auth_error");
    params.delete("auth_success");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

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
        setSelectedProfileId((prev) => {
          if (prev || !rows[0]) return prev;
          const preferred = userId ? rows.find((row) => row.id === userId) ?? rows[0] : rows[0];
          return preferred.id;
        });
      } catch (error) {
        setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load profiles" });
      }
    })();
  }, [userId]);

  useEffect(() => {
    const target = selectedProfileId ?? userId ?? null;
    if (!target) return;
    let cancelled = false;
    void (async () => {
      try {
        setLoadingProfile(true);
        const detail = await apiFetch<ProfileDetail>(`/api/profiles/${target}`);
        if (cancelled) return;
        setProfileDetail(detail);
        syncReviewState(detail);

        if (userId && detail.profile.id === userId) {
          setEditName(detail.profile.displayName);
          setEditBio(detail.profile.bio ?? "");
          setEditAvatarUrl(detail.profile.avatarUrl ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load profile" });
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProfileId, userId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = await loadLeaflet();
      if (cancelled) return;

      // If the map container was unmounted while switching tabs, discard stale instance.
      if (mapRef.current) {
        const connected = mapRef.current.getContainer()?.isConnected ?? false;
        if (!connected) {
          mapRef.current.remove();
          mapRef.current = null;
          markersLayerRef.current = null;
        }
      }

      if (!mapRef.current && mapElRef.current) {
        const map = L.map(mapElRef.current, {
          center: [24.7136, 46.6753],
          zoom: 5,
          zoomControl: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
        mapRef.current = map;
        markersLayerRef.current = L.layerGroup().addTo(map);
      }

      if (!pickerMapRef.current && pickerMapElRef.current) {
        const pickerMap = L.map(pickerMapElRef.current, {
          center: [24.7136, 46.6753],
          zoom: 5,
          zoomControl: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(pickerMap);

        pickerMap.on("click", (event) => {
          const latNum = event.latlng.lat;
          const lngNum = event.latlng.lng;
          setPinLat(latNum.toFixed(6));
          setPinLng(lngNum.toFixed(6));

          if (pickerMarkerRef.current) pickerMarkerRef.current.remove();

          pickerMarkerRef.current = L.circleMarker([latNum, lngNum], {
            radius: 8,
            color: "#0f172a",
            fillColor: "#f97316",
            fillOpacity: 0.95,
            weight: 2,
          }).addTo(pickerMap);
        });

        pickerMapRef.current = pickerMap;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "map") return;
    const map = mapRef.current;
    if (!map) return;
    window.setTimeout(() => map.invalidateSize(), 120);
  }, [activeView]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    void (async () => {
      const L = await loadLeaflet();
      layer.clearLayers();

      const boundsPoints: Array<[number, number]> = [];
      for (const activity of filteredActivities) {
        if (typeof activity.lat !== "number" || typeof activity.lng !== "number") continue;
        const marker = L.circleMarker([activity.lat, activity.lng], {
          radius: selectedActivityId === activity.id ? 9 : 7,
          color: "#0f172a",
          fillColor: selectedActivityId === activity.id ? "#f97316" : "#38bdf8",
          fillOpacity: 0.95,
          weight: 2,
        });
        marker.on("click", () => setSelectedActivityId(activity.id));
        marker.bindTooltip(activity.title, { direction: "top" });
        marker.addTo(layer);
        boundsPoints.push([activity.lat, activity.lng]);
      }

      if (boundsPoints.length > 0) {
        const bounds = L.latLngBounds(boundsPoints);
        map.fitBounds(bounds, { padding: [18, 18] });
        if (map.getZoom() > 14) map.setZoom(14);
      }
    })();
  }, [filteredActivities, selectedActivityId]);

  useEffect(() => {
    if (!selectedActivity || !mapRef.current) return;
    if (typeof selectedActivity.lat !== "number" || typeof selectedActivity.lng !== "number") return;
    mapRef.current.panTo([selectedActivity.lat, selectedActivity.lng]);
  }, [selectedActivity]);

  useEffect(() => {
    const pullLatest = () => {
      void (async () => {
        try {
          const rows = await apiFetch<Activity[]>("/api/activities");
          setActivities(rows);
          setSelectedActivityId((prev) => prev ?? rows[0]?.id ?? null);
        } catch {
          // Ignore silent polling failures.
        }
      })();

      void (async () => {
        try {
          const rows = await apiFetch<ProfileSummary[]>("/api/profiles");
          setProfiles(rows);
        } catch {
          // Ignore silent polling failures.
        }
      })();
    };

    const timer = window.setInterval(pullLatest, 45_000);
    window.addEventListener("focus", pullLatest);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", pullLatest);
    };
  }, []);

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

  async function refreshActivities() {
    try {
      const rows = await apiFetch<Activity[]>("/api/activities");
      setActivities(rows);
      setSelectedActivityId((prev) => prev ?? rows[0]?.id ?? null);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not refresh activities" });
    }
  }

  async function refreshProfiles() {
    try {
      const rows = await apiFetch<ProfileSummary[]>("/api/profiles");
      setProfiles(rows);
      setSelectedProfileId((prev) => {
        if (prev || !rows[0]) return prev;
        const preferred = userId ? rows.find((row) => row.id === userId) ?? rows[0] : rows[0];
        return preferred.id;
      });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load profiles" });
    }
  }

  function syncReviewState(detail: ProfileDetail) {
    if (!detail.reviewContext) {
      setReviewMode("profile");
      setReviewActivityId("");
      return;
    }

    const reviewed = new Set(detail.reviewContext.reviewedActivityIds);
    const options = detail.reviewContext.eligibleActivities.filter((activity) => !reviewed.has(activity.id));

    if (options.length > 0) {
      setReviewActivityId((prev) => (prev && options.some((activity) => activity.id === prev) ? prev : options[0].id));
    } else {
      setReviewActivityId("");
    }

    if (!detail.reviewContext.canSubmitProfileReview && options.length > 0) {
      setReviewMode("activity");
    } else {
      setReviewMode((prev) => (prev === "activity" && options.length === 0 ? "profile" : prev));
    }
  }

  async function loadProfile(profileId: string) {
    setLoadingProfile(true);
    try {
      const detail = await apiFetch<ProfileDetail>(`/api/profiles/${profileId}`);
      setProfileDetail(detail);
      syncReviewState(detail);

      if (userId && detail.profile.id === userId) {
        setEditName(detail.profile.displayName);
        setEditBio(detail.profile.bio ?? "");
        setEditAvatarUrl(detail.profile.avatarUrl ?? "");
      }
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load profile" });
    } finally {
      setLoadingProfile(false);
    }
  }

  async function installApp() {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  }

  async function searchPinLocation() {
    const q = pinSearchQuery.trim();
    if (!q) {
      setPinSearchResults([]);
      return;
    }

    setPinSearchLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error("Search failed");
      const rows = (await res.json()) as NominatimResult[];
      setPinSearchResults(rows);
    } catch {
      setPinSearchResults([]);
      setToast({ tone: "error", message: "Location search failed" });
    } finally {
      setPinSearchLoading(false);
    }
  }

  function selectPinResult(result: NominatimResult) {
    const latNum = Number.parseFloat(result.lat);
    const lngNum = Number.parseFloat(result.lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return;

    setPinLat(latNum.toFixed(6));
    setPinLng(lngNum.toFixed(6));

    const pickerMap = pickerMapRef.current;
    if (!pickerMap) return;

    void (async () => {
      const L = await loadLeaflet();
      pickerMap.setView([latNum, lngNum], 12);
      if (pickerMarkerRef.current) pickerMarkerRef.current.remove();
      pickerMarkerRef.current = L.circleMarker([latNum, lngNum], {
        radius: 8,
        color: "#0f172a",
        fillColor: "#f97316",
        fillOpacity: 0.95,
        weight: 2,
      }).addTo(pickerMap);
    })();
  }

  async function createActivity() {
    if (!userId) {
      setToast({ tone: "error", message: "Login required" });
      return;
    }

    const cleanTitle = safeText(title);
    const cleanDescription = safeText(description);
    const cleanLocation = safeText(location);
    const latNum = Number.parseFloat(pinLat);
    const lngNum = Number.parseFloat(pinLng);
    const limitNum = limit.trim() ? clampInt(limit, 2, 200) : null;

    if (!cleanTitle || !cleanLocation || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      setToast({ tone: "error", message: "Title, location, and map pin are required." });
      return;
    }

    const when = new Date(`${date}T${time}:00`);
    if (Number.isNaN(when.getTime())) {
      setToast({ tone: "error", message: "Pick a valid date and time." });
      return;
    }

    try {
      const created = await apiFetch<Activity>("/api/activities", {
        method: "POST",
        body: JSON.stringify({
          title: cleanTitle,
          description: cleanDescription || null,
          location: cleanLocation,
          lat: latNum,
          lng: lngNum,
          whenISO: when.toISOString(),
          type,
          limit: limitNum,
        }),
      });

      setActivities((prev) => [...prev, created]);
      setSelectedActivityId(created.id);
      setToast({ tone: "info", message: "Activity posted." });

      setTitle("");
      setDescription("");
      setLocation("");
      setType("chill");
      setLimit("");
      setPinSearchQuery("");
      setPinSearchResults([]);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not create activity" });
    }
  }

  async function toggleJoin(activity: Activity) {
    if (!userId) {
      setToast({ tone: "error", message: "Login required" });
      return;
    }

    try {
      const path = activity.joined ? `/api/activities/${activity.id}/leave` : `/api/activities/${activity.id}/join`;
      const updated = await apiFetch<Activity>(path, { method: "POST" });

      setActivities((prev) =>
        prev.map((row) =>
          row.id === activity.id
            ? {
                ...row,
                ...updated,
                creatorName: row.creatorName,
              }
            : row,
        ),
      );

      setToast({ tone: "info", message: updated.joined ? "You joined." : "You left." });
      if (activeView === "profiles") {
        void refreshProfiles();
        if (selectedProfileId) {
          void loadProfile(selectedProfileId);
        }
      }
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not update attendance" });
    }
  }

  async function login() {
    try {
      const res = await apiFetch<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      setUser(res.user);
      setEditName(res.user.displayName);
      setEditBio(res.user.bio ?? "");
      setEditAvatarUrl(res.user.avatarUrl ?? "");
      setAuthPassword("");
      setToast({ tone: "info", message: `Welcome back ${res.user.displayName}.` });
      await refreshActivities();
      await refreshProfiles();
      setSelectedProfileId(res.user.id);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Login failed" });
    }
  }

  async function signup() {
    try {
      const res = await apiFetch<{ user: User }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          displayName: authName,
          email: authEmail,
          password: authPassword,
        }),
      });
      setUser(res.user);
      setEditName(res.user.displayName);
      setEditBio(res.user.bio ?? "");
      setEditAvatarUrl(res.user.avatarUrl ?? "");
      setAuthPassword("");
      setToast({ tone: "info", message: `Account created for ${res.user.displayName}.` });
      await refreshActivities();
      await refreshProfiles();
      setSelectedProfileId(res.user.id);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Signup failed" });
    }
  }

  async function logout() {
    try {
      await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      setUser(null);
      setEditName("");
      setEditBio("");
      setEditAvatarUrl("");
      setToast({ tone: "info", message: "You are signed out." });
      await refreshActivities();
      await refreshProfiles();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Logout failed" });
    }
  }

  function startGoogleLogin() {
    window.location.href = "/api/auth/google/start";
  }

  async function saveProfile() {
    if (!user) return;

    try {
      const updated = await apiFetch<User>(`/api/profiles/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: editName,
          bio: editBio,
          avatarUrl: editAvatarUrl,
        }),
      });
      setUser(updated);
      setToast({ tone: "info", message: "Profile updated." });
      await refreshProfiles();
      await loadProfile(updated.id);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not save profile" });
    }
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
      await refreshProfiles();
      await loadProfile(profileDetail.profile.id);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not post review" });
    }
  }

  async function postGalleryEntry() {
    if (!user || !profileDetail || profileDetail.profile.id !== user.id) return;

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
      await refreshProfiles();
      await loadProfile(user.id);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not add diary entry" });
    }
  }

  function jumpToActivity(activityId: string) {
    setActiveView("map");
    setSelectedActivityId(activityId);
    if (isMobileViewport()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="min-h-dvh text-white pb-24 lg:pb-8">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />

      <header className="relative z-10 mx-auto max-w-[1500px] px-4 pt-6 lg:px-8 lg:pt-8">
        <div className="shell-panel p-4 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="label-kicker">Urban Social Atlas</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-5xl">Hangout Control Room</h1>
              <p className="mt-2 text-sm text-white/75 lg:text-base">
                Plan local moments, monitor map activity in real-time, and keep your community reputation growing.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 lg:gap-3 min-w-[280px]">
              <div className="metric-card">
                <p className="metric-label">Upcoming</p>
                <p className="metric-value">{upcomingCount}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Open Seats</p>
                <p className="metric-value">{openSeatCount}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Members</p>
                <p className="metric-value">{profiles.length}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView("map")}
              className={`tab-chip ${activeView === "map" ? "tab-chip-active" : ""}`}
            >
              Live Map
            </button>
            <button
              type="button"
              onClick={() => setActiveView("profiles")}
              className={`tab-chip ${activeView === "profiles" ? "tab-chip-active" : ""}`}
            >
              Community
            </button>
            {installPromptEvent ? (
              <button type="button" className="tab-chip ml-auto" onClick={() => void installApp()}>
                Install App
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto mt-4 max-w-[1500px] px-4 lg:px-8">
        {!backendOk ? (
          <section className="shell-panel p-4 lg:p-6 mb-4">
            <h2 className="text-xl font-semibold">Backend unavailable</h2>
            <p className="text-sm text-white/75 mt-1">Set your database and env config, then reload to enable live data.</p>
          </section>
        ) : null}

        {activeView === "map" ? (
          <section className="grid gap-4 lg:grid-cols-[350px_1fr_360px]">
            <aside className="shell-panel p-4 lg:p-5 space-y-4">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Filters</h2>
                  <button type="button" className="link-btn" onClick={() => void refreshActivities()}>
                    Refresh
                  </button>
                </div>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, place, host"
                  className="field"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select value={filterType} onChange={(event) => setFilterType(event.target.value as typeof filterType)} className="field">
                    <option value="all">All types</option>
                    <option value="chill">Chill</option>
                    <option value="active">Active</option>
                    <option value="help">Help</option>
                  </select>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="field">
                    <option value="soonest">Soonest</option>
                    <option value="newest">Newest</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} className="accent-orange-400" />
                  Only show activities with open seats
                </label>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Create activity</h2>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="field" />
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="field min-h-20" />
                <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location label" className="field" />

                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="field" />
                  <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="field" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select value={type} onChange={(event) => setType(event.target.value as ActivityType)} className="field">
                    <option value="chill">Chill</option>
                    <option value="active">Active</option>
                    <option value="help">Help</option>
                  </select>
                  <input value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="Limit optional" className="field" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={pinSearchQuery}
                      onChange={(event) => setPinSearchQuery(event.target.value)}
                      placeholder="Search pin location"
                      className="field"
                    />
                    <button type="button" className="action-ghost whitespace-nowrap" onClick={() => void searchPinLocation()}>
                      {pinSearchLoading ? "..." : "Find"}
                    </button>
                  </div>

                  {pinSearchResults.length > 0 ? (
                    <div className="max-h-32 overflow-auto rounded-xl border border-white/15 bg-black/20">
                      {pinSearchResults.map((row) => (
                        <button
                          key={row.place_id}
                          type="button"
                          onClick={() => selectPinResult(row)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-white/10"
                        >
                          {row.display_name}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <input value={pinLat} onChange={(event) => setPinLat(event.target.value)} placeholder="Lat" className="field" />
                    <input value={pinLng} onChange={(event) => setPinLng(event.target.value)} placeholder="Lng" className="field" />
                  </div>

                  <div ref={pickerMapElRef} className="h-40 rounded-2xl border border-white/20 overflow-hidden" />
                </div>

                <button type="button" className="action-primary w-full" onClick={() => void createActivity()}>
                  Publish Activity
                </button>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Account</h2>
                  {user ? (
                    <button type="button" onClick={() => void logout()} className="link-btn">
                      Logout
                    </button>
                  ) : null}
                </div>

                {user ? (
                  <div className="rounded-2xl border border-white/15 bg-black/20 p-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={user.displayName} avatarUrl={user.avatarUrl} />
                      <div>
                        <p className="font-semibold">{user.displayName}</p>
                        <p className="text-xs text-white/70">{user.email}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {authMode === "signup" ? (
                      <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Display name" className="field" />
                    ) : null}
                    <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" className="field" />
                    <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" className="field" />
                    <button
                      type="button"
                      className="action-primary w-full"
                      onClick={() => void (authMode === "login" ? login() : signup())}
                    >
                      {authMode === "login" ? "Login" : "Create account"}
                    </button>
                    <button type="button" className="action-ghost w-full" onClick={startGoogleLogin}>
                      Continue with Google
                    </button>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setAuthMode((prev) => (prev === "login" ? "signup" : "login"))}
                    >
                      {authMode === "login" ? "Need an account? Sign up" : "Already have an account? Login"}
                    </button>
                  </div>
                )}
              </section>
            </aside>

            <section className="shell-panel p-3 lg:p-4">
              <div ref={mapElRef} className="h-[320px] lg:h-[760px] rounded-[20px] overflow-hidden border border-white/20" />
            </section>

            <aside className="shell-panel p-4 lg:p-5 space-y-3">
              <h2 className="text-lg font-semibold">Activity rail</h2>

              <div className="max-h-[280px] lg:max-h-[460px] overflow-auto space-y-2 pr-1">
                {filteredActivities.length === 0 ? (
                  <p className="text-sm text-white/70">No activities found.</p>
                ) : (
                  filteredActivities.map((activity) => {
                    const closed = isClosedByWhen(activity.whenISO, nowTick);
                    const full = activity.limit !== null && activity.going >= activity.limit;
                    const stateLabel = closed ? "Closed" : full ? "Full" : "Open";
                    const stateClass = closed ? "text-red-300" : full ? "text-yellow-300" : "text-emerald-300";

                    return (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() => setSelectedActivityId(activity.id)}
                        className={`w-full rounded-2xl border p-3 text-left transition ${
                          selectedActivityId === activity.id
                            ? "border-orange-400 bg-orange-500/12"
                            : "border-white/15 bg-black/20 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm leading-tight">{activity.title}</p>
                          <span className={`text-xs ${stateClass}`}>{stateLabel}</span>
                        </div>
                        <p className="mt-1 text-xs text-white/70">{activity.location}</p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-white/60">
                          <span>{TYPE_META[activity.type].label}</span>
                          <span>-</span>
                          <span>{formatWhen(activity.whenISO)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedActivity ? (
                <article className="rounded-2xl border border-white/20 bg-black/25 p-3">
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <Image
                      src={TYPE_META[selectedActivity.type].scene}
                      alt={selectedActivity.type}
                      width={900}
                      height={420}
                      className="h-32 w-full object-cover"
                    />
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold leading-tight">{selectedActivity.title}</h3>
                      {selectedTypeMeta ? (
                        <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: `${selectedTypeMeta.accent}33`, color: selectedTypeMeta.accent }}>
                          {selectedTypeMeta.label}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-white/75">{selectedActivity.description || "No description provided."}</p>
                    <p className="text-xs text-white/60">By {selectedActivity.creatorName}</p>
                    <p className="text-xs text-white/60">{selectedActivity.location}</p>
                    <p className="text-xs text-white/60">{formatWhen(selectedActivity.whenISO)}</p>
                    <p className="text-xs text-white/60">
                      {selectedActivity.going}
                      {selectedActivity.limit !== null ? ` / ${selectedActivity.limit}` : ""} going
                    </p>
                  </div>

                  <button
                    type="button"
                    className="action-primary w-full mt-3"
                    disabled={isClosedByWhen(selectedActivity.whenISO, nowTick)}
                    onClick={() => void toggleJoin(selectedActivity)}
                  >
                    {selectedActivity.joined ? "Leave" : "Join"}
                  </button>
                </article>
              ) : null}
            </aside>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <aside className="shell-panel p-4 lg:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">People</h2>
                <button type="button" onClick={() => void refreshProfiles()} className="link-btn">
                  Refresh
                </button>
              </div>

              <div className="mt-3 max-h-[780px] overflow-auto space-y-2 pr-1">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedProfileId(profile.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selectedProfileId === profile.id
                        ? "border-orange-400 bg-orange-500/12"
                        : "border-white/15 bg-black/20 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={profile.displayName} avatarUrl={profile.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-sm">{profile.displayName}</p>
                        <p className="truncate text-xs text-white/65">
                          {profile.avgRating !== null ? `${profile.avgRating.toFixed(1)} stars` : "No rating"} - {profile.reviewCount} reviews
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {profile.badges.slice(0, 3).map((badge) => (
                        <span key={badge.id} className="rounded-full border border-white/20 bg-white/8 px-2 py-1 text-[11px]">
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="shell-panel p-4 lg:p-5">
              {loadingProfile ? (
                <p className="text-sm text-white/70">Loading profile...</p>
              ) : !profileDetail ? (
                <p className="text-sm text-white/70">Select a profile.</p>
              ) : (
                <div className="space-y-4">
                  <article className="rounded-2xl border border-white/20 bg-black/20 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name={profileDetail.profile.displayName} avatarUrl={profileDetail.profile.avatarUrl} />
                        <div>
                          <h2 className="text-xl font-semibold">{profileDetail.profile.displayName}</h2>
                          <p className="text-sm text-white/70">{profileDetail.profile.bio || "No bio yet."}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-center">
                        <div className="metric-card"><p className="metric-label">Created</p><p className="metric-value text-xl">{profileDetail.stats.createdCount}</p></div>
                        <div className="metric-card"><p className="metric-label">Joined</p><p className="metric-value text-xl">{profileDetail.stats.joinedCount}</p></div>
                        <div className="metric-card"><p className="metric-label">Diary</p><p className="metric-value text-xl">{profileDetail.stats.diaryCount}</p></div>
                        <div className="metric-card"><p className="metric-label">Reviews</p><p className="metric-value text-xl">{profileDetail.stats.reviewCount}</p></div>
                        <div className="metric-card"><p className="metric-label">Rating</p><p className="metric-value text-xl">{profileDetail.stats.avgRating ?? "-"}</p></div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {profileDetail.stats.badges.map((badge) => (
                        <span key={badge.id} title={badge.description} className="rounded-full border border-white/20 bg-white/8 px-2.5 py-1 text-xs">
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </article>

                  {user && user.id === profileDetail.profile.id ? (
                    <article className="rounded-2xl border border-white/20 bg-black/20 p-4 space-y-2">
                      <h3 className="text-base font-semibold">Edit profile</h3>
                      <input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Display name" className="field" />
                      <input value={editAvatarUrl} onChange={(event) => setEditAvatarUrl(event.target.value)} placeholder="Avatar URL" className="field" />
                      <textarea value={editBio} onChange={(event) => setEditBio(event.target.value)} placeholder="Bio" className="field min-h-20" />
                      <button type="button" className="action-primary" onClick={() => void saveProfile()}>
                        Save Profile
                      </button>
                    </article>
                  ) : null}

                  {!user ? (
                    <article className="rounded-2xl border border-white/20 bg-black/20 p-4 space-y-2">
                      <h3 className="text-base font-semibold">Reviews need an account</h3>
                      <p className="text-sm text-white/70">Login first, then join shared activities to unlock reputation reviews.</p>
                      <button type="button" className="action-primary" onClick={startGoogleLogin}>
                        Continue with Google
                      </button>
                    </article>
                  ) : null}

                  {user && user.id !== profileDetail.profile.id ? (
                    <article className="rounded-2xl border border-white/20 bg-black/20 p-4 space-y-2">
                      <h3 className="text-base font-semibold">Write review</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setReviewMode("profile")}
                          disabled={!profileDetail.reviewContext?.canSubmitProfileReview}
                          className={`action-ghost ${reviewMode === "profile" ? "bg-white/20" : ""}`}
                        >
                          Whole profile
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewMode("activity")}
                          disabled={availableActivityReviewOptions.length === 0}
                          className={`action-ghost ${reviewMode === "activity" ? "bg-white/20" : ""}`}
                        >
                          Specific activity
                        </button>
                      </div>

                      {reviewMode === "activity" ? (
                        <select value={reviewActivityId} onChange={(event) => setReviewActivityId(event.target.value)} className="field">
                          {availableActivityReviewOptions.length === 0 ? <option value="">No shared activities</option> : null}
                          {availableActivityReviewOptions.map((activity) => (
                            <option key={activity.id} value={activity.id}>
                              {activity.title} - {activity.location}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-white/65">
                          {profileDetail.reviewContext?.canSubmitProfileReview
                            ? "This posts one full profile review."
                            : "Profile review unlocks after at least one shared activity and only once."}
                        </p>
                      )}

                      <div className="grid grid-cols-[120px_1fr] gap-2">
                        <select value={reviewRating} onChange={(event) => setReviewRating(event.target.value)} className="field">
                          <option value="5">5 stars</option>
                          <option value="4">4 stars</option>
                          <option value="3">3 stars</option>
                          <option value="2">2 stars</option>
                          <option value="1">1 star</option>
                        </select>
                        <input value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Comment" className="field" />
                      </div>

                      <button
                        type="button"
                        className="action-primary"
                        onClick={() => void postReview()}
                        disabled={reviewMode === "profile" ? !profileDetail.reviewContext?.canSubmitProfileReview : availableActivityReviewOptions.length === 0}
                      >
                        Post Review
                      </button>
                    </article>
                  ) : null}

                  {user && user.id === profileDetail.profile.id ? (
                    <article className="rounded-2xl border border-white/20 bg-black/20 p-4 space-y-2">
                      <h3 className="text-base font-semibold">Add diary entry</h3>
                      <input value={galleryImageUrl} onChange={(event) => setGalleryImageUrl(event.target.value)} placeholder="Image URL" className="field" />
                      <input value={galleryCaption} onChange={(event) => setGalleryCaption(event.target.value)} placeholder="Caption" className="field" />
                      <input value={galleryLocation} onChange={(event) => setGalleryLocation(event.target.value)} placeholder="Location optional" className="field" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={galleryLat} onChange={(event) => setGalleryLat(event.target.value)} placeholder="Lat optional" className="field" />
                        <input value={galleryLng} onChange={(event) => setGalleryLng(event.target.value)} placeholder="Lng optional" className="field" />
                      </div>
                      <button type="button" className="action-primary" onClick={() => void postGalleryEntry()}>
                        Add Diary Entry
                      </button>
                    </article>
                  ) : null}

                  {profileDetail.recentActivities.length > 0 ? (
                    <article className="rounded-2xl border border-white/20 bg-black/20 p-4">
                      <h3 className="text-base font-semibold">Recent activities</h3>
                      <div className="mt-2 space-y-2">
                        {profileDetail.recentActivities.slice(0, 5).map((activity) => (
                          <button
                            key={activity.id}
                            type="button"
                            onClick={() => jumpToActivity(activity.id)}
                            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-left hover:bg-white/12"
                          >
                            <p className="text-sm font-medium">{activity.title}</p>
                            <p className="text-xs text-white/70">{activity.location} - {formatWhen(activity.whenISO)}</p>
                          </button>
                        ))}
                      </div>
                    </article>
                  ) : null}

                  <article className="rounded-2xl border border-white/20 bg-black/20 p-4">
                    <h3 className="text-base font-semibold">Reviews</h3>
                    {profileDetail.reviews.length === 0 ? (
                      <p className="mt-2 text-sm text-white/70">No reviews yet.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {profileDetail.reviews.map((review) => (
                          <div key={review.id} className="rounded-xl border border-white/15 bg-white/5 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold">{review.author?.displayName ?? "User"}</p>
                              <p className="text-xs text-white/65">{review.rating}/5</p>
                            </div>
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-white/55">
                              {review.reviewType === "activity"
                                ? `Activity review${review.activityTitle ? ` - ${review.activityTitle}` : ""}`
                                : "Whole profile review"}
                            </p>
                            <p className="mt-1 text-sm text-white/80">{review.comment}</p>
                            <p className="mt-1 text-xs text-white/55">{formatWhen(review.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>

                  <article className="rounded-2xl border border-white/20 bg-black/20 p-4">
                    <h3 className="text-base font-semibold">Photo diary</h3>
                    {profileDetail.gallery.length === 0 ? (
                      <p className="mt-2 text-sm text-white/70">No entries yet.</p>
                    ) : (
                      <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {profileDetail.gallery.map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                            <div className="relative h-40 w-full">
                              <Image
                                src={entry.imageUrl}
                                alt={entry.caption}
                                fill
                                unoptimized
                                sizes="(max-width: 1024px) 100vw, 40vw"
                                className="object-cover"
                              />
                            </div>
                            <div className="p-3">
                              <p className="text-sm font-medium">{entry.caption}</p>
                              {entry.location ? <p className="text-xs text-white/65 mt-1">{entry.location}</p> : null}
                              {entry.lat !== null && entry.lng !== null ? (
                                <p className="text-xs text-white/55">{entry.lat.toFixed(5)}, {entry.lng.toFixed(5)}</p>
                              ) : null}
                              <p className="text-xs text-white/55 mt-1">{formatWhen(entry.createdAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              )}
            </section>
          </section>
        )}
      </main>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className={`rounded-full px-4 py-2 text-sm font-medium shadow-lg ${toast.tone === "error" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"}`}>
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}
