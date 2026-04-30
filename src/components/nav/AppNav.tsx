"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { cn } from "@/components/ui/cn";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type ChatThreadRow = {
  id: string;
  otherUser: { id: string; displayName: string; avatarUrl: string | null } | null;
  unreadCount: number;
  updatedAt: string;
  lastMessage: { id: string; body: string; authorUserId: string; createdAt: string } | null;
};

type ChatMessageRow = {
  id: string;
  threadId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  authorUserId: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type") && options?.body) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...options, headers, credentials: "include", cache: options?.cache ?? "no-store" });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data as any)?.error;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data as T;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", theme);
}

function loadTheme(): Theme {
  try {
    const v = window.localStorage.getItem("billixa-theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // ignore
  }
  return "system";
}

function saveTheme(theme: Theme) {
  try {
    window.localStorage.setItem("billixa-theme", theme);
  } catch {
    // ignore
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const initial = loadTheme();
    setTheme(initial);
    setSystemTheme(getSystemTheme());
    applyTheme(initial);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(getSystemTheme());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const label = useMemo(() => {
    const resolved = theme === "system" ? systemTheme : theme;
    return resolved === "dark" ? "Dark" : "Light";
  }, [theme, systemTheme]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        const next: Theme = theme === "system" ? (systemTheme === "dark" ? "light" : "dark") : theme === "dark" ? "light" : "dark";
        setTheme(next);
        saveTheme(next);
        applyTheme(next);
      }}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {label}
    </Button>
  );
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-2xl border border-[color-mix(in_oklab,var(--border)_75%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_40%,transparent)]">
      {children}
    </span>
  );
}

export default function AppNav({ active }: { active: "map" | "feed" | "community" | "profile" | "reviews" | "admin" | null }) {
  const pathname = usePathname();
  const inferred: typeof active = useMemo(() => {
    if (!pathname) return null;
    if (pathname.startsWith("/admin")) return "admin";
    if (pathname.startsWith("/reviews")) return "reviews";
    if (pathname.startsWith("/profile")) return "profile";
    if (pathname.startsWith("/feed")) return "feed";
    if (pathname.startsWith("/community")) return "community";
    if (pathname.startsWith("/map")) return "map";
    return null;
  }, [pathname]);
  const current = active ?? inferred;
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRows, setNotifRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatRows, setChatRows] = useState<ChatThreadRow[]>([]);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageRow[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMessageBusy, setChatMessageBusy] = useState(false);
  const [chatBody, setChatBody] = useState("");
  const [chatTargetUserId, setChatTargetUserId] = useState("");

  async function refreshNotifications() {
    try {
      const data = await apiFetch<{ items: NotificationRow[]; unreadCount: number }>("/api/notifications?limit=40", { cache: "no-store" });
      setNotifRows(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // Not logged in or transient failures.
    }
  }

  useEffect(() => {
    void refreshNotifications();
    const t = window.setInterval(() => void refreshNotifications(), 45_000);
    return () => window.clearInterval(t);
  }, []);

  async function refreshChats() {
    try {
      const data = await apiFetch<{ items: ChatThreadRow[] }>("/api/chats", { cache: "no-store" });
      setChatRows(data.items);
      setChatUnreadCount(data.items.reduce((sum, row) => sum + Math.max(0, row.unreadCount || 0), 0));
      if (!selectedChatId && data.items.length > 0) setSelectedChatId(data.items[0]!.id);
    } catch {
      setChatRows([]);
      setChatUnreadCount(0);
    }
  }

  async function refreshChatMessages(threadId: string) {
    setChatBusy(true);
    try {
      const rows = await apiFetch<ChatMessageRow[]>(`/api/chats/${threadId}/messages`, { cache: "no-store" });
      setChatMessages(rows);
    } catch {
      setChatMessages([]);
    } finally {
      setChatBusy(false);
    }
  }

  async function markChatRead(threadId: string) {
    try {
      await apiFetch<{ ok: boolean }>(`/api/chats/${threadId}/read`, { method: "POST" });
      await refreshChats();
    } catch {
      // ignore
    }
  }

  async function startChat() {
    const targetId = chatTargetUserId.trim();
    if (!targetId) return;
    try {
      const created = await apiFetch<{ threadId: string }>("/api/chats", {
        method: "POST",
        body: JSON.stringify({ userId: targetId }),
      });
      setChatTargetUserId("");
      setSelectedChatId(created.threadId);
      await refreshChats();
      await refreshChatMessages(created.threadId);
    } catch {
      // ignore
    }
  }

  async function sendChatMessage() {
    const threadId = selectedChatId;
    const body = chatBody.trim();
    if (!threadId || !body) return;
    setChatMessageBusy(true);
    try {
      await apiFetch<ChatMessageRow>(`/api/chats/${threadId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setChatBody("");
      await refreshChats();
      await refreshChatMessages(threadId);
    } finally {
      setChatMessageBusy(false);
    }
  }

  useEffect(() => {
    void refreshChats();
    const t = window.setInterval(() => void refreshChats(), 20_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!chatOpen || !selectedChatId) return;
    void refreshChatMessages(selectedChatId);
    void markChatRead(selectedChatId);
  }, [chatOpen, selectedChatId]);

  useEffect(() => {
    setPushSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      } catch {
        setPushEnabled(false);
      }
    })();
  }, []);

  async function enablePush() {
    if (!pushSupported) return;
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Notifications permission denied");
      const { publicKey } = await apiFetch<{ publicKey: string }>("/api/push/public-key", { cache: "no-store" });
      if (!publicKey) throw new Error("Push not configured on server");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await apiFetch("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) });
      setPushEnabled(true);
    } catch {
      setPushEnabled(false);
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    if (!pushSupported) return;
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiFetch("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setPushEnabled(false);
    } catch {
      // ignore
    } finally {
      setPushBusy(false);
    }
  }

  async function markAllRead() {
    try {
      await apiFetch("/api/notifications/mark-read", { method: "POST", body: JSON.stringify({ all: true }) });
      await refreshNotifications();
    } catch {
      // ignore
    }
  }

  return (
    <>
      <header className="relative z-20 mx-auto w-full max-w-[1500px] px-3 pt-3 lg:px-8 lg:pt-8">
        <div className="shell-panel px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/map" className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
                Social atlas
              </p>
              <p className="truncate text-lg font-bold tracking-tight" data-heading="true">
                <span className="text-gradient">BilliXa</span>
              </p>
            </Link>

            <div className="hidden items-center gap-2 lg:flex">
              <Link className={cn("tab-chip", current === "map" && "tab-chip-active")} href="/map">
                Map
              </Link>
              <Link className={cn("tab-chip", current === "feed" && "tab-chip-active")} href="/feed">
                Feed
              </Link>
              <Link className={cn("tab-chip", current === "community" && "tab-chip-active")} href="/community">
                Community
              </Link>
              <Link className={cn("tab-chip", current === "reviews" && "tab-chip-active")} href="/reviews">
                Reviews
              </Link>
              <Link className={cn("tab-chip", current === "profile" && "tab-chip-active")} href="/profile">
                Me
              </Link>
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(true);
                  void refreshNotifications();
                }}
                className="relative rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[color-mix(in_oklab,var(--surface2)_50%,transparent)]"
                aria-label="Notifications"
                title="Notifications"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>Alerts</span>
                  {unreadCount > 0 ? (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[color-mix(in_oklab,var(--accent)_78%,transparent)] px-1 text-[10px] font-extrabold text-black">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setChatOpen(true);
                  void refreshChats();
                }}
                className="relative rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[color-mix(in_oklab,var(--surface2)_50%,transparent)]"
                aria-label="Chats"
                title="Chats"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>Chats</span>
                  {chatUnreadCount > 0 ? (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[color-mix(in_oklab,var(--accent2)_75%,transparent)] px-1 text-[10px] font-extrabold text-black">
                      {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                    </span>
                  ) : null}
                </span>
              </button>
              <ThemeToggle />
            </div>

            <div className="lg:hidden">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChatOpen(true);
                    void refreshChats();
                  }}
                  className="relative rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[color-mix(in_oklab,var(--surface2)_50%,transparent)]"
                  aria-label="Chats"
                  title="Chats"
                >
                  Chats
                  {chatUnreadCount > 0 ? (
                    <span className="ml-1.5 inline-grid h-4 min-w-4 place-items-center rounded-full bg-[color-mix(in_oklab,var(--accent2)_75%,transparent)] px-1 text-[10px] font-extrabold text-black">
                      {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                    </span>
                  ) : null}
                </button>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </header>

      <Modal
        open={notifOpen}
        title="Notifications"
        onClose={() => setNotifOpen(false)}
        size="md"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="tab-chip" onClick={() => void refreshNotifications()}>
              Refresh
            </button>
            <button type="button" className="tab-chip" onClick={() => void markAllRead()}>
              Mark all read
            </button>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] p-3">
            <p className="text-sm font-semibold" data-heading="true">
              Push notifications
            </p>
            <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
              Enable push to get real-time alerts even when the app is closed.
            </p>
            <div className="mt-2 flex items-center gap-2">
              {pushEnabled ? (
                <button type="button" className="tab-chip" disabled={pushBusy} onClick={() => void disablePush()}>
                  Disable push
                </button>
              ) : (
                <button type="button" className="tab-chip tab-chip-active" disabled={pushBusy} onClick={() => void enablePush()}>
                  Enable push
                </button>
              )}
              {!pushSupported ? <span className="text-xs text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">Not supported</span> : null}
            </div>
          </div>

          <div className="space-y-2">
            {notifRows.length === 0 ? (
              <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No notifications.</p>
            ) : (
              notifRows.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={cn(
                    "w-full rounded-[var(--radius-md)] border px-3 py-2 text-left hover:bg-[color-mix(in_oklab,var(--surface2)_50%,transparent)]",
                    n.readAt ? "border-[color-mix(in_oklab,var(--border)_70%,transparent)]" : "border-[color-mix(in_oklab,var(--accent)_55%,transparent)]",
                  )}
                  onClick={() => {
                    if (!n.readAt) {
                      void apiFetch("/api/notifications/mark-read", { method: "POST", body: JSON.stringify({ ids: [n.id] }) }).then(() => void refreshNotifications());
                    }
                    if (n.href) window.location.href = n.href;
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {!n.readAt ? <span className="text-[10px] font-extrabold uppercase tracking-wide text-[color-mix(in_oklab,var(--accent)_80%,var(--text)_20%)]">New</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">{n.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>

      <Modal open={chatOpen} title="Chats" onClose={() => setChatOpen(false)} size="lg">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={chatTargetUserId}
              onChange={(e) => setChatTargetUserId(e.target.value)}
              placeholder="Start chat by user ID"
              className="w-full rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button type="button" className="tab-chip tab-chip-active" onClick={() => void startChat()}>
              Start
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
            <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
              {chatRows.length === 0 ? (
                <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No chats yet.</p>
              ) : (
                chatRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedChatId(row.id)}
                    className={cn(
                      "w-full rounded-[var(--radius-md)] border px-3 py-2 text-left",
                      selectedChatId === row.id
                        ? "border-[color-mix(in_oklab,var(--accent)_55%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_55%,transparent)]"
                        : "border-[color-mix(in_oklab,var(--border)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{row.otherUser?.displayName ?? "Unknown user"}</p>
                      {row.unreadCount > 0 ? (
                        <span className="rounded-full bg-[color-mix(in_oklab,var(--accent2)_75%,transparent)] px-1.5 py-0.5 text-[10px] font-extrabold text-black">
                          {row.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
                      {row.lastMessage?.body ?? "No messages yet"}
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_75%,transparent)] p-3">
              {!selectedChatId ? (
                <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Choose a chat to start messaging.</p>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-[44vh] space-y-2 overflow-auto pr-1">
                    {chatBusy ? (
                      <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Loading…</p>
                    ) : chatMessages.length === 0 ? (
                      <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No messages yet.</p>
                    ) : (
                      chatMessages
                        .slice()
                        .reverse()
                        .map((message) => (
                          <div key={message.id} className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_65%,transparent)] px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold">{message.author.displayName}</p>
                              <p className="text-[10px] text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">
                                {new Date(message.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <p className="mt-1 text-sm">{message.body}</p>
                          </div>
                        ))
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={chatBody}
                      onChange={(e) => setChatBody(e.target.value)}
                      placeholder="Write a message"
                      className="w-full rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-transparent px-3 py-2 text-sm outline-none"
                    />
                    <button
                      type="button"
                      className="tab-chip tab-chip-active"
                      disabled={chatMessageBusy || !chatBody.trim()}
                      onClick={() => void sendChatMessage()}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[color-mix(in_oklab,var(--border)_75%,transparent)] bg-[color-mix(in_oklab,var(--surface)_40%,transparent)] backdrop-blur-[var(--blur)] lg:hidden">
        <div className="mx-auto flex max-w-[1500px] items-center justify-around px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <Link
            href="/map"
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-semibold",
              current === "map" ? "text-[color-mix(in_oklab,var(--accent)_75%,var(--text)_25%)]" : "text-[color-mix(in_oklab,var(--muted)_70%,transparent)]",
            )}
          >
            <NavIcon>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </NavIcon>
            Map
          </Link>

          <Link
            href="/feed"
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-semibold",
              current === "feed" ? "text-[color-mix(in_oklab,var(--accent)_75%,var(--text)_25%)]" : "text-[color-mix(in_oklab,var(--muted)_70%,transparent)]",
            )}
          >
            <NavIcon>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </NavIcon>
            Feed
          </Link>

          <Link
            href="/community"
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-semibold",
              current === "community" ? "text-[color-mix(in_oklab,var(--accent)_75%,var(--text)_25%)]" : "text-[color-mix(in_oklab,var(--muted)_70%,transparent)]",
            )}
          >
            <NavIcon>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </NavIcon>
            People
          </Link>

          <Link
            href="/profile"
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-semibold",
              current === "profile" ? "text-[color-mix(in_oklab,var(--accent)_75%,var(--text)_25%)]" : "text-[color-mix(in_oklab,var(--muted)_70%,transparent)]",
            )}
          >
            <NavIcon>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </NavIcon>
            Me
          </Link>
        </div>
      </nav>
    </>
  );
}
