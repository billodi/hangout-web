"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";

interface AdminStats {
  totalUsers: number;
  totalActivities: number;
  totalParticipants: number;
}

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isAdmin: number;
  role: string;
  createdAt: string;
}

interface AdminActivity {
  id: string;
  title: string;
  location: string;
  type: string;
  whenISO: string;
  going: number;
  limit: number | null;
  createdAt: string;
  creatorName: string | null;
}

export default function AdminApp() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "activities">("overview");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadAdminData() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load admin data");
      }
      const data = await res.json();
      setStats(data.stats);
      setUsers(data.users);
      setActivities(data.recentActivities);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function performAction(endpoint: string, body: object) {
    try {
      setActionLoading("loading");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      await loadAdminData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAdminData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh p-4">
        <div className="shell-panel p-6 text-center">
          <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh p-4">
        <div className="shell-panel p-6">
          <h1 className="text-xl font-bold text-[color-mix(in_oklab,#f43f5e_75%,var(--text)_25%)]" data-heading="true">
            Access denied
          </h1>
          <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">{error}</p>
          <Link href="/map" className="mt-4 inline-flex">
            <Button variant="secondary">Back to site</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1500px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-10 lg:pt-6">
      <section className="shell-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
              Admin
            </p>
            <h1 className="text-xl font-semibold" data-heading="true">
              Control room
            </h1>
            <p className="mt-1 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
              Moderate users and activities.
            </p>
          </div>
          <Link href="/map">
            <Button size="sm" variant="secondary">
              Back to site
            </Button>
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[color-mix(in_oklab,var(--border)_75%,transparent)] pt-3">
          {(["overview", "users", "activities"] as const).map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={activeTab === tab ? "primary" : "secondary"}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => void loadAdminData()}>
            Refresh
          </Button>
        </div>
      </section>

      <section className="mt-4">
        {activeTab === "overview" && stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="shell-panel p-4">
              <p className="text-xs uppercase tracking-wider text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">Total Users</p>
              <p className="mt-1 text-3xl font-bold text-gradient">{stats.totalUsers}</p>
            </div>
            <div className="shell-panel p-4">
              <p className="text-xs uppercase tracking-wider text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">Activities</p>
              <p className="mt-1 text-3xl font-bold text-gradient">{stats.totalActivities}</p>
            </div>
            <div className="shell-panel p-4">
              <p className="text-xs uppercase tracking-wider text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">Participants</p>
              <p className="mt-1 text-3xl font-bold text-gradient">{stats.totalParticipants}</p>
            </div>
            <div className="shell-panel p-4">
              <p className="text-xs uppercase tracking-wider text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">Active</p>
              <p className="mt-1 text-3xl font-bold text-[color-mix(in_oklab,var(--accent2)_80%,var(--text)_20%)]">•</p>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="shell-panel p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold" data-heading="true">
                User management
              </h2>
              <p className="text-xs text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">{users.length} users</p>
            </div>

            <div className="mt-3 overflow-x-auto rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color-mix(in_oklab,var(--border)_75%,transparent)] text-left text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Joined</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-[color-mix(in_oklab,var(--border)_65%,transparent)]">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full border border-[color-mix(in_oklab,var(--border)_75%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_40%,transparent)] grid place-items-center text-xs font-bold">
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold">{user.displayName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">{user.email}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-[color-mix(in_oklab,var(--border)_70%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_40%,transparent)] px-2.5 py-1 text-xs font-semibold">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">{formatDate(user.createdAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {user.role !== "owner" && (
                            <>
                              {user.role === "banned" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => performAction("/api/admin/users", { action: "unban", userId: user.id })}
                                  disabled={!!actionLoading}
                                >
                                  Unban
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => performAction("/api/admin/users", { action: "ban", userId: user.id })}
                                  disabled={!!actionLoading}
                                >
                                  Ban
                                </Button>
                              )}
                              <Select
                                className="w-[160px] text-xs"
                                value={user.role}
                                onChange={(e) => performAction("/api/admin/users", { action: "set_role", userId: user.id, role: e.target.value })}
                                disabled={!!actionLoading}
                              >
                                <option value="user">User</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                                <option value="owner">Owner</option>
                              </Select>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "activities" && (
          <div className="shell-panel p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold" data-heading="true">
                Activity moderation
              </h2>
              <p className="text-xs text-[color-mix(in_oklab,var(--muted)_70%,transparent)]">{activities.length} recent</p>
            </div>
            <div className="mt-3 space-y-2">
              {activities.length === 0 ? (
                <p className="text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">No activities yet</p>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-[var(--radius-md)] bg-[color-mix(in_oklab,var(--surface2)_42%,transparent)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)]"
                  >
                    <div>
                      <p className="font-semibold">{activity.title}</p>
                      <p className="text-xs text-[color-mix(in_oklab,var(--muted)_72%,transparent)]">
                        {activity.location} • by {activity.creatorName ?? "Unknown"} • {activity.going}/{activity.limit ?? "∞"} going
                      </p>
                      <p className="text-xs text-[color-mix(in_oklab,var(--muted)_65%,transparent)]">{formatDate(activity.createdAt)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (confirm("Delete this activity? This cannot be undone.")) {
                          performAction("/api/admin/activities", { action: "delete", activityId: activity.id });
                        }
                      }}
                      disabled={!!actionLoading}
                    >
                      Delete
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

