"use client";

import { useEffect, useMemo, useState } from "react";

type ActivityType = "chill" | "active" | "help";

type Activity = {
  id: string;
  title: string;
  location: string;
  whenISO: string;
  type: ActivityType;
  going: number;
  limit: number | null;
  createdAt: string;
};

const THEME_KEY = "hangout.theme";

const typeMeta: Record<ActivityType, { label: string; badge: string }> = {
  chill: { label: "Chill", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  active: { label: "Active", badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  help: { label: "Help", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
};

function safeText(value: unknown): string {
  return String(value ?? "").trim();
}

function formatWhen(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "Unknown time";
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date} - ${time}`;
}

function clampInt(value: string, min: number, max: number): number | null {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = (data as { error?: string } | null)?.error;
    throw new Error(err || `Request failed (${res.status})`);
  }
  return data as T;
}

function getTheme(): "light" | "dark" | "system" {
  const v = localStorage.getItem(THEME_KEY);
  if (v === "light" || v === "dark") return v;
  return "system";
}

function applyTheme() {
  const theme = getTheme();
  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = theme === "dark" || (theme === "system" && systemDark);
  document.documentElement.classList.toggle("dark", useDark);
}

export default function HangoutApp({
  initialActivities,
  initialBackendOk,
}: {
  initialActivities: Activity[];
  initialBackendOk: boolean;
}) {
  return <HangoutAppInner initialActivities={initialActivities} initialBackendOk={initialBackendOk} />;
}

function HangoutAppInner({
  initialActivities,
  initialBackendOk,
}: {
  initialActivities: Activity[];
  initialBackendOk: boolean;
}) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [backendOk] = useState<boolean>(initialBackendOk);

  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<"all" | ActivityType>("all");
  const [sortBy, setSortBy] = useState<"soonest" | "newest">("soonest");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [time, setTime] = useState(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${min}`;
  });
  const [type, setType] = useState<ActivityType>("chill");
  const [limit, setLimit] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    applyTheme();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Optional: you can add a refresh button later to re-fetch from the API.

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    const items = activities.filter((a) => {
      const hay = `${a.title} ${a.location} ${a.type}`.toLowerCase();
      if (qLower && !hay.includes(qLower)) return false;
      if (filterType !== "all" && a.type !== filterType) return false;
      if (onlyOpen && a.limit !== null && a.going >= a.limit) return false;
      return true;
    });

    items.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(a.whenISO).getTime() - new Date(b.whenISO).getTime();
    });
    return items;
  }, [activities, q, filterType, onlyOpen, sortBy]);

  function resetForm() {
    setTitle("");
    setLocation("");
    setType("chill");
    setLimit("");
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
    setTime(`${hh}:${min}`);
  }

  async function createActivity() {
    if (!backendOk) {
      setToast("Backend not reachable.");
      return;
    }

    const t = safeText(title);
    const l = safeText(location);
    if (!t || !l || !date || !time) {
      setToast("Fill in plan, location, date, and time.");
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
          location: l,
          whenISO: when.toISOString(),
          type,
          limit: limitNum,
        }),
      });
      setActivities((prev) => [created, ...prev]);
      setToast("Created.");
      resetForm();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function join(id: string) {
    try {
      const updated = await apiFetch<Activity>(`/api/activities/${id}/join`, { method: "POST" });
      setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setToast("Joined.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Join failed");
    }
  }

  async function leave(id: string) {
    try {
      const updated = await apiFetch<Activity>(`/api/activities/${id}/leave`, { method: "POST" });
      setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setToast("Updated.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function del(id: string) {
    const act = activities.find((a) => a.id === id);
    if (!act) return;
    const ok = confirm(`Delete "${act.title}"?`);
    if (!ok) return;

    try {
      await apiFetch(`/api/activities/${id}`, { method: "DELETE" });
      setActivities((prev) => prev.filter((a) => a.id !== id));
      setToast("Deleted.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function cycleTheme() {
    const current = getTheme();
    const next = current === "dark" ? "light" : current === "light" ? "system" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme();
    setToast(`Theme: ${next}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-950/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">Hangout</h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 truncate">Find and post simple plans nearby.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={cycleTheme}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                title="Toggle theme"
                aria-label="Toggle theme"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"></path>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("title")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="h-9 px-3 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-sm font-medium"
              >
                New
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          <section className="lg:sticky lg:top-[76px]">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_10px_30px_-15px_rgba(0,0,0,.25)]">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight">Create activity</h2>
                <button onClick={resetForm} type="button" className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                  Reset
                </button>
              </div>

              <form
                className="p-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void createActivity();
                }}
              >
                <div>
                  <label htmlFor="title" className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                    Plan
                  </label>
                  <input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    type="text"
                    placeholder="e.g. Karak at the park"
                    className="mt-1 w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20"
                    maxLength={80}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="location" className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                    Location
                  </label>
                  <input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    type="text"
                    placeholder="City / area"
                    className="mt-1 w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20"
                    maxLength={60}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="date" className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                      Date
                    </label>
                    <input
                      id="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      type="date"
                      className="mt-1 w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="time" className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                      Time
                    </label>
                    <input
                      id="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      type="time"
                      className="mt-1 w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="type" className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                      Type
                    </label>
                    <select
                      id="type"
                      value={type}
                      onChange={(e) => setType(e.target.value as ActivityType)}
                      className="mt-1 w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20"
                    >
                      <option value="chill">Chill</option>
                      <option value="active">Active</option>
                      <option value="help">Help</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="limit" className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                      Max people
                    </label>
                    <input
                      id="limit"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      type="number"
                      min={2}
                      max={200}
                      placeholder="Optional"
                      className="mt-1 w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <button type="submit" className="w-full h-10 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-sm font-medium">
                    Create
                  </button>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{backendOk ? "Connected to backend." : "Backend not reachable."}</p>
                </div>
              </form>
            </div>
          </section>

          <section className="min-w-0">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_10px_30px_-15px_rgba(0,0,0,.25)]">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold tracking-tight">Nearby feed</h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{filtered.length} shown - {activities.length} total</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        type="search"
                        placeholder="Search"
                        className="h-9 w-[min(320px,70vw)] sm:w-56 pl-9 pr-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 text-sm"
                      />
                      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.3-4.3"></path>
                      </svg>
                    </div>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value as "all" | ActivityType)} className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm">
                      <option value="all">All types</option>
                      <option value="chill">Chill</option>
                      <option value="active">Active</option>
                      <option value="help">Help</option>
                    </select>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "soonest" | "newest")} className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm">
                      <option value="soonest">Soonest</option>
                      <option value="newest">Newest</option>
                    </select>
                    <label className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm select-none">
                      <input checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} type="checkbox" className="h-4 w-4" />
                      <span>Open</span>
                    </label>
                  </div>
                </div>
              </div>

              {!backendOk ? (
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                    Backend is not reachable. Check your `DATABASE_URL` and refresh.
                  </div>
                </div>
              ) : null}

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="mx-auto h-12 w-12 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500">
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M8 2v4"></path>
                        <path d="M16 2v4"></path>
                        <path d="M3 10h18"></path>
                        <path d="M21 8v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"></path>
                      </svg>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">No activities match your filters</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Try clearing search or creating a new one.</p>
                  </div>
                ) : (
                  filtered.map((act) => {
                    const meta = typeMeta[act.type] || typeMeta.chill;
                    const when = formatWhen(act.whenISO);
                    const isFull = act.limit !== null && act.going >= act.limit;
                    const pct = act.limit ? Math.min(100, Math.round((act.going / act.limit) * 100)) : null;
                    const limitText = act.limit ? `${act.going}/${act.limit}` : `${act.going}/unlimited`;

                    return (
                      <div key={act.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center h-6 px-2 rounded-md text-xs font-medium ${meta.badge}`}>{meta.label}</span>
                              <span className="text-xs text-slate-600 dark:text-slate-300">{act.location}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">-</span>
                              <span className="text-xs text-slate-600 dark:text-slate-300">{when}</span>
                            </div>
                            <h3 className="mt-2 text-base font-semibold leading-tight break-words">{act.title}</h3>
                            <div className="mt-2 flex items-center gap-3 flex-wrap">
                              <span className="text-xs text-slate-600 dark:text-slate-300">Going: {limitText}</span>
                              {pct === null ? null : (
                                <div className="w-40 max-w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" title={`${pct}% full`}>
                                  <div className={`h-full ${isFull ? "bg-rose-500" : "bg-slate-900 dark:bg-white"}`} style={{ width: `${pct}%` }} />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void join(act.id)}
                              disabled={!backendOk || isFull}
                              className={`h-9 px-3 rounded-md text-sm font-medium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 ${isFull ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              {isFull ? "Full" : "Join"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void leave(act.id)}
                              disabled={!backendOk}
                              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800"
                              title="Leave"
                              aria-label="Leave"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12h14"></path>
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => void del(act.id)}
                              disabled={!backendOk}
                              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800"
                              title="Delete"
                              aria-label="Delete"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6h18"></path>
                                <path d="M8 6V4h8v2"></path>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                                <path d="M10 11v6"></path>
                                <path d="M14 11v6"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {toast ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2">
          <div className="max-w-[92vw] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_10px_30px_-15px_rgba(0,0,0,.25)] px-4 py-3 text-sm flex items-center gap-3">
            <span className="text-slate-800 dark:text-slate-100">{toast}</span>
            <button type="button" className="ml-auto text-slate-500 hover:text-slate-900 dark:hover:text-white" aria-label="Close" onClick={() => setToast(null)}>
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
