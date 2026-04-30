"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import Sheet from "@/components/ui/Sheet";
import Toast, { type ToastTone } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatWhen } from "@/lib/formatWhen";

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

type User = {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isAdmin: number;
  role: string;
  createdAt: string;
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

function loadLeaflet(): Promise<LeafletModule> {
  if (!leafletLoader) leafletLoader = import("leaflet");
  return leafletLoader;
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 rounded-full object-cover border border-[color-mix(in_oklab,var(--border)_85%,transparent)]"
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="h-10 w-10 rounded-full border border-[color-mix(in_oklab,var(--border)_85%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)] grid place-items-center text-xs font-bold">
      {initial}
    </div>
  );
}

export default function MapScreen({
  initialActivities,
  initialBackendOk,
  initialUser,
  preferredActivityId,
}: {
  initialActivities: Activity[];
  initialBackendOk: boolean;
  initialUser: User | null;
  preferredActivityId?: string | null;
}) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [backendOk] = useState(initialBackendOk);
  const [user, setUser] = useState<User | null>(initialUser);
  const userId = user?.id ?? null;

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | ActivityType>("all");
  const [sortBy, setSortBy] = useState<"soonest" | "newest">("soonest");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    preferredActivityId ?? initialActivities[0]?.id ?? null,
  );
  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === selectedActivityId) ?? null,
    [activities, selectedActivityId],
  );

  const [showCreate, setShowCreate] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  /** Single map container must exist — do not mount desktop+mobile layouts at once or `mapElRef` breaks. */
  const [useDesktopLayout, setUseDesktopLayout] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [time, setTime] = useState(() => toTimeInput(new Date()));
  const [type, setType] = useState<ActivityType>("chill");
  const [limit, setLimit] = useState("");
  const [pinLat, setPinLat] = useState("");
  const [pinLng, setPinLng] = useState("");
  const [pinSearchQuery, setPinSearchQuery] = useState("");
  const [pinSearchResults, setPinSearchResults] = useState<NominatimResult[]>([]);
  const [pinSearchLoading, setPinSearchLoading] = useState(false);

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const pickerMapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pickerMapRef = useRef<LeafletMap | null>(null);
  const pickerMarkerRef = useRef<LeafletCircleMarker | null>(null);
  const markersLayerRef = useRef<LeafletLayerGroup | null>(null);
  /** Bumped after main map instance is created so marker/pan effects re-run when map was briefly null. */
  const [mapEpoch, setMapEpoch] = useState(0);

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
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(a.whenISO).getTime() - new Date(b.whenISO).getTime();
    });
    return list;
  }, [activities, search, filterType, sortBy, onlyOpen, nowTick]);

  const upcomingCount = useMemo(
    () => activities.filter((activity) => !isClosedByWhen(activity.whenISO, nowTick)).length,
    [activities, nowTick],
  );
  const openSeatCount = useMemo(
    () => activities.filter((activity) => activity.limit === null || activity.going < activity.limit).length,
    [activities],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiFetch<{ user: User | null }>("/api/auth/me", { cache: "no-store" });
        if (me.user) setUser(me.user);
      } catch {
        // ignore
      }
    })();
  }, []);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setUseDesktopLayout(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  function invalidateMapSoon(delays: number[] = [0, 120, 260]) {
    for (const delay of delays) {
      window.setTimeout(() => mapRef.current?.invalidateSize(true), delay);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapElRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
      }

      const map = L.map(mapElRef.current, { center: [24.7136, 46.6753], zoom: 5, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      mapRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      invalidateMapSoon();
      if (!cancelled) setMapEpoch((e) => e + 1);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, [useDesktopLayout]);

  useEffect(() => {
    if (!showCreate) {
      if (pickerMapRef.current) {
        pickerMapRef.current.remove();
        pickerMapRef.current = null;
        pickerMarkerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    void (async () => {
      const L = await loadLeaflet();
      if (cancelled || !pickerMapElRef.current) return;

      if (pickerMapRef.current) {
        pickerMapRef.current.remove();
        pickerMapRef.current = null;
        pickerMarkerRef.current = null;
      }

      const pickerMap = L.map(pickerMapElRef.current, { center: [24.7136, 46.6753], zoom: 5, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(pickerMap);
      pickerMap.on("click", (event) => {
        const latNum = event.latlng.lat;
        const lngNum = event.latlng.lng;
        setPinLat(latNum.toFixed(6));
        setPinLng(lngNum.toFixed(6));
        if (pickerMarkerRef.current) pickerMarkerRef.current.remove();
        pickerMarkerRef.current = L.circleMarker([latNum, lngNum], {
          radius: 8,
          color: "#0f172a",
          fillColor: "var(--accent)",
          fillOpacity: 0.95,
          weight: 2,
        }).addTo(pickerMap);
      });
      pickerMapRef.current = pickerMap;
      window.setTimeout(() => pickerMap.invalidateSize(), 80);
    })();

    return () => {
      cancelled = true;
      if (pickerMapRef.current) {
        pickerMapRef.current.remove();
        pickerMapRef.current = null;
        pickerMarkerRef.current = null;
      }
    };
  }, [showCreate]);

  useEffect(() => {
    const onResize = () => invalidateMapSoon([0, 120]);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
          fillColor: selectedActivityId === activity.id ? "var(--accent)" : "var(--accent2)",
          fillOpacity: 0.95,
          weight: 2,
        });
        marker.on("click", () => {
          setSelectedActivityId(activity.id);
          if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) {
            setMobileSheetOpen(true);
          }
        });
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
  }, [filteredActivities, selectedActivityId, mapEpoch]);

  useEffect(() => {
    if (!selectedActivity || !mapRef.current) return;
    if (typeof selectedActivity.lat !== "number" || typeof selectedActivity.lng !== "number") return;
    mapRef.current.panTo([selectedActivity.lat, selectedActivity.lng]);
  }, [selectedActivity, mapEpoch]);

  useEffect(() => {
    const pullLatest = () => {
      void (async () => {
        try {
          const rows = await apiFetch<Activity[]>("/api/activities");
          setActivities(rows);
          setSelectedActivityId((prev) => prev ?? rows[0]?.id ?? null);
        } catch {
          // ignore
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

  async function refreshActivities() {
    try {
      const rows = await apiFetch<Activity[]>("/api/activities");
      setActivities(rows);
      setSelectedActivityId((prev) => prev ?? rows[0]?.id ?? null);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not refresh activities" });
    }
  }

  async function toggleJoin(activity: Activity) {
    if (!userId) {
      setToast({ tone: "error", message: "Login required" });
      setShowAuth(true);
      return;
    }
    if (activity.joined && activity.creatorId === userId) {
      setToast({ tone: "error", message: "Creators cannot leave their own activity." });
      return;
    }
    try {
      const path = activity.joined ? `/api/activities/${activity.id}/leave` : `/api/activities/${activity.id}/join`;
      const updated = await apiFetch<Activity>(path, { method: "POST" });
      setActivities((prev) =>
        prev.map((row) => (row.id === activity.id ? { ...row, ...updated, creatorName: row.creatorName } : row)),
      );
      setToast({ tone: "info", message: updated.joined ? "You joined." : "You left." });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not update attendance" });
    }
  }

  function startGoogleLogin() {
    window.location.href = "/api/auth/google/start";
  }

  async function login() {
    try {
      const res = await apiFetch<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      setUser(res.user);
      setAuthPassword("");
      setToast({ tone: "info", message: `Welcome back ${res.user.displayName}.` });
      setShowAuth(false);
      await refreshActivities();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Login failed" });
    }
  }

  async function signup() {
    try {
      const res = await apiFetch<{ user: User }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ displayName: authName, email: authEmail, password: authPassword }),
      });
      setUser(res.user);
      setAuthPassword("");
      setToast({ tone: "info", message: `Account created for ${res.user.displayName}.` });
      setShowAuth(false);
      await refreshActivities();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Signup failed" });
    }
  }

  async function logout() {
    try {
      await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      setUser(null);
      setToast({ tone: "info", message: "You are signed out." });
      await refreshActivities();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Logout failed" });
    }
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
      const res = await fetch(url, { headers: { Accept: "application/json" } });
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
    setPinSearchQuery(result.display_name);

    const pickerMap = pickerMapRef.current;
    if (!pickerMap) return;
    void (async () => {
      const L = await loadLeaflet();
      pickerMap.setView([latNum, lngNum], 12);
      if (pickerMarkerRef.current) pickerMarkerRef.current.remove();
      pickerMarkerRef.current = L.circleMarker([latNum, lngNum], {
        radius: 8,
        color: "#0f172a",
        fillColor: "var(--accent)",
        fillOpacity: 0.95,
        weight: 2,
      }).addTo(pickerMap);
    })();
  }

  async function createActivity() {
    if (!userId) {
      setToast({ tone: "error", message: "Login required" });
      setShowAuth(true);
      return;
    }
    const cleanTitle = safeText(title);
    const cleanDescription = safeText(description);
    const cleanLocation = safeText(pinSearchQuery);
    const latNum = Number.parseFloat(pinLat);
    const lngNum = Number.parseFloat(pinLng);
    const limitNum = limit.trim() ? clampInt(limit, 2, 200) : null;

    if (!cleanTitle || !cleanLocation || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      setToast({ tone: "error", message: "Title, location label, and map pin are required." });
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
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setType("chill");
      setLimit("");
      setPinSearchQuery("");
      setPinSearchResults([]);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not create activity" });
    }
  }

  const isSelectedActivityOwner = !!(selectedActivity && userId && selectedActivity.creatorId === userId);

  function ActivityCard({ activity }: { activity: Activity }) {
    const closed = isClosedByWhen(activity.whenISO, nowTick);
    const full = activity.limit !== null && activity.going >= activity.limit;
    const stateLabel = closed ? "Closed" : full ? "Full" : "Open";
    const stateColor = closed ? "#f43f5e" : full ? "#f7c94b" : "#34d399";

    return (
      <button
        type="button"
        onClick={() => setSelectedActivityId(activity.id)}
        className="w-full rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)] p-3 text-left transition hover:bg-[color-mix(in_oklab,var(--surface2)_52%,transparent)]"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold leading-tight">{activity.title}</p>
          <span className="text-[11px] font-bold" style={{ color: stateColor }}>
            {stateLabel}
          </span>
        </div>
        <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">{activity.location}</p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">
          <span>{TYPE_META[activity.type].label}</span>
          <span>•</span>
          <span>{formatWhen(activity.whenISO)}</span>
        </div>
      </button>
    );
  }

  function Details({ activity }: { activity: Activity }) {
    const typeMeta = TYPE_META[activity.type];
    const disabled = isClosedByWhen(activity.whenISO, nowTick) || (activity.joined && activity.creatorId === userId);
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_75%,transparent)]">
          <Image src={typeMeta.scene} alt={activity.type} width={900} height={420} className="h-28 w-full object-cover" />
        </div>

        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold leading-tight" data-heading="true">
              {activity.title}
            </h3>
            <span
              className="rounded-full px-2 py-1 text-[11px] font-bold"
              style={{ background: `${typeMeta.accent}22`, color: typeMeta.accent }}
            >
              {typeMeta.label}
            </span>
          </div>
          <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">{activity.description || "No description."}</p>
          <p className="text-xs text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">By {activity.creatorName}</p>
          <p className="text-xs text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">{activity.location}</p>
          <p className="text-xs text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">{formatWhen(activity.whenISO)}</p>
          <p className="text-xs text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
            {activity.going}
            {activity.limit !== null ? ` / ${activity.limit}` : ""} going
          </p>
        </div>

        <Button variant="primary" className="w-full" disabled={disabled} onClick={() => void toggleJoin(activity)}>
          {activity.joined ? (activity.creatorId === userId ? "Host" : "Leave") : "Join"}
        </Button>

        {isSelectedActivityOwner ? (
          <p className="text-xs text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">
            Editing/deleting stays available from the desktop view for now (coming back in the next pass).
          </p>
        ) : null}
      </div>
    );
  }

  const desktopPanels = (
    <section className="grid gap-4 lg:grid-cols-[360px_1fr_360px]">
      <aside className="shell-panel p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
              Activity pulse
            </p>
            <h2 className="text-lg font-semibold" data-heading="true">
              Map feed
            </h2>
          </div>
          <Button size="sm" variant="ghost" onClick={() => void refreshActivities()}>
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="metric-card">
            <p className="metric-label">Upcoming</p>
            <p className="metric-value">{upcomingCount}</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Open seats</p>
            <p className="metric-value">{openSeatCount}</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Shown</p>
            <p className="metric-value">{filteredActivities.length}</p>
          </div>
        </div>

        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, place, host" />

        <div className="grid grid-cols-2 gap-2">
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}>
            <option value="all">All types</option>
            <option value="chill">Chill</option>
            <option value="active">Active</option>
            <option value="help">Help</option>
          </Select>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="soonest">Soonest</option>
            <option value="newest">Newest</option>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-[var(--accent)]" />
          Only show open
        </label>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            Create
          </Button>
          {!user ? (
            <Button variant="secondary" onClick={() => setShowAuth(true)}>
              Login
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => void logout()}>
              Logout
            </Button>
          )}
        </div>

        {user ? (
          <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_40%,transparent)] p-3">
            <div className="flex items-center gap-2">
              <Avatar name={user.displayName} avatarUrl={user.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.displayName}</p>
                <p className="truncate text-xs text-[color-mix(in_oklab,var(--muted)_72%,transparent)]">{user.email}</p>
              </div>
            </div>
          </div>
        ) : null}
      </aside>

      <section className="shell-panel p-3">
        <div ref={mapElRef} className="h-[760px] rounded-[var(--radius-lg)] overflow-hidden border border-[color-mix(in_oklab,var(--border)_75%,transparent)]" />
      </section>

      <aside className="shell-panel p-4 space-y-3">
        <h2 className="text-lg font-semibold" data-heading="true">
          Activities
        </h2>
        <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
          {filteredActivities.length === 0 ? (
            <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No activities found.</p>
          ) : (
            filteredActivities.map((a) => <ActivityCard key={a.id} activity={a} />)
          )}
        </div>
        {selectedActivity ? (
          <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_40%,transparent)] p-3">
            <Details activity={selectedActivity} />
          </div>
        ) : null}
      </aside>
    </section>
  );

  const mobile = (
    <section className="space-y-3">
      <div className="shell-panel p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
              Live map
            </p>
            <p className="text-sm font-semibold" data-heading="true">
              {filteredActivities.length} activities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={mobileSheetOpen ? "secondary" : "ghost"} onClick={() => setMobileSheetOpen((o) => !o)}>
              {mobileSheetOpen ? "Close" : "Browse"}
            </Button>
            <Button size="sm" variant="primary" onClick={() => setShowCreate(true)}>
              + Create
            </Button>
          </div>
        </div>
      </div>

      <div className="shell-panel p-2.5">
        <div ref={mapElRef} className="h-[64vh] rounded-[var(--radius-lg)] overflow-hidden border border-[color-mix(in_oklab,var(--border)_75%,transparent)]" />
      </div>

      <Sheet open={mobileSheetOpen} title="Activities" onClose={() => setMobileSheetOpen(false)} height="full">
        <div className="space-y-3">
          <Button className="w-full" variant="primary" onClick={() => setMobileSheetOpen(false)}>
            Back to map
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" />
            <Button variant="ghost" onClick={() => void refreshActivities()}>
              Refresh
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}>
              <option value="all">All types</option>
              <option value="chill">Chill</option>
              <option value="active">Active</option>
              <option value="help">Help</option>
            </Select>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
              <option value="soonest">Soonest</option>
              <option value="newest">Newest</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-[var(--accent)]" />
            Only show open
          </label>

          <div className="space-y-2">
            {filteredActivities.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </div>

          {selectedActivity ? (
            <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_40%,transparent)] p-3">
              <Details activity={selectedActivity} />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 pt-2">
            {!user ? (
              <>
                <Button variant="secondary" onClick={() => setShowAuth(true)}>
                  Login
                </Button>
                <Button variant="ghost" onClick={startGoogleLogin}>
                  Google
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => void logout()}>
                  Logout
                </Button>
                <Button variant="secondary" onClick={() => setShowCreate(true)}>
                  Create
                </Button>
              </>
            )}
          </div>
        </div>
      </Sheet>
    </section>
  );

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1500px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-10 lg:pt-6 text-[var(--text)]">
      {!backendOk ? (
        <div className="shell-panel p-4 mb-4">
          <h2 className="text-lg font-semibold" data-heading="true">
            Backend unavailable
          </h2>
          <p className="mt-1 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
            Set your database and env config, then reload to enable live data.
          </p>
        </div>
      ) : null}

      {useDesktopLayout ? desktopPanels : mobile}

      <Modal open={showCreate} title="Create activity" onClose={() => setShowCreate(false)} size="lg" position="offsetTop">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            <Select value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
              <option value="chill">Chill</option>
              <option value="active">Active</option>
              <option value="help">Help</option>
            </Select>
          </div>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="min-h-20" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Limit (optional)" inputMode="numeric" />

          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={pinSearchQuery} onChange={(e) => setPinSearchQuery(e.target.value)} placeholder="Search pin location (label)" />
              <Button variant="ghost" onClick={() => void searchPinLocation()}>
                {pinSearchLoading ? "..." : "Find"}
              </Button>
            </div>

            {pinSearchResults.length > 0 ? (
              <div className="max-h-40 overflow-auto rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_35%,transparent)]">
                {pinSearchResults.map((row) => (
                  <button
                    key={row.place_id}
                    type="button"
                    onClick={() => selectPinResult(row)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-[color-mix(in_oklab,var(--surface2)_52%,transparent)]"
                  >
                    {row.display_name}
                  </button>
                ))}
              </div>
            ) : null}

            <div
              ref={pickerMapElRef}
              className="h-56 rounded-[var(--radius-lg)] border border-[color-mix(in_oklab,var(--border)_75%,transparent)] overflow-hidden"
            />
          </div>

          <Button variant="primary" className="w-full" onClick={() => void createActivity()}>
            Publish
          </Button>
        </div>
      </Modal>

      <Modal open={showAuth} title={authMode === "login" ? "Welcome back" : "Join BilliXa"} onClose={() => setShowAuth(false)} size="sm">
        <div className="space-y-3">
          {authMode === "signup" ? (
            <Input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Display name" />
          ) : null}
          <Input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" />
          <Input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" />
          <Button variant="primary" className="w-full" onClick={() => void (authMode === "login" ? login() : signup())}>
            {authMode === "login" ? "Sign in" : "Create account"}
          </Button>
          <Button variant="secondary" className="w-full" onClick={startGoogleLogin}>
            Continue with Google
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm font-semibold text-[color-mix(in_oklab,var(--accent2)_70%,var(--text)_30%)] underline underline-offset-4"
            onClick={() => setAuthMode((p) => (p === "login" ? "signup" : "login"))}
          >
            {authMode === "login" ? "Need an account? Sign up" : "Already have an account? Login"}
          </button>
        </div>
      </Modal>

      <Toast toast={toast} onClear={() => setToast(null)} />
    </main>
  );
}
