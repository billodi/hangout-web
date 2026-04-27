"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

  useEffect(() => {
    void loadAdminData();
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-dvh text-white p-4">
        <div className="shell-panel p-6 text-center">
          <p className="text-white/70">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh text-white p-4">
        <div className="shell-panel p-6">
          <h1 className="text-xl font-bold text-red-400">Access Denied</h1>
          <p className="mt-2 text-white/70">{error}</p>
          <Link href="/" className="action-ghost mt-4 inline-block">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh text-white pb-12">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />

      <header className="relative z-10 mx-auto max-w-[1500px] px-3 pt-3 lg:px-8 lg:pt-8">
        <div className="shell-panel p-3 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-kicker flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Admin Panel
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight lg:text-4xl">
                <span className="text-gradient">BilliXa</span> Admin
              </h1>
            </div>
            <Link href="/" className="action-ghost">
              ← Back to Site
            </Link>
          </div>

          <nav className="mt-4 flex gap-2 border-b border-white/10 pb-2">
            {(["overview", "users", "activities"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === tab
                    ? "bg-orange-500/20 text-orange-400"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1500px] px-3 lg:mt-4 lg:px-8">
        {activeTab === "overview" && stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="shell-panel p-4">
              <p className="text-xs text-white/50 uppercase tracking-wider">Total Users</p>
              <p className="mt-1 text-3xl font-bold text-gradient">{stats.totalUsers}</p>
            </div>
            <div className="shell-panel p-4">
              <p className="text-xs text-white/50 uppercase tracking-wider">Activities</p>
              <p className="mt-1 text-3xl font-bold text-gradient">{stats.totalActivities}</p>
            </div>
            <div className="shell-panel p-4">
              <p className="text-xs text-white/50 uppercase tracking-wider">Participants</p>
              <p className="mt-1 text-3xl font-bold text-gradient">{stats.totalParticipants}</p>
            </div>
            <div className="shell-panel p-4">
              <p className="text-xs text-white/50 uppercase tracking-wider">Active Now</p>
              <p className="mt-1 text-3xl font-bold text-teal-400">●</p>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="shell-panel p-3 lg:p-4">
            <h2 className="text-lg font-semibold">User Management</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/50">
                    <th className="pb-2 pr-2">User</th>
                    <th className="pb-2 pr-2">Email</th>
                    <th className="pb-2 pr-2">Role</th>
                    <th className="pb-2 pr-2">Joined</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-white/5">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/10 grid place-items-center text-xs font-bold">
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{user.displayName}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-white/70">{user.email}</td>
                      <td className="py-2 pr-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          user.role === "owner" ? "bg-purple-500/30 text-purple-300" :
                          user.role === "admin" ? "bg-red-500/30 text-red-300" :
                          user.role === "moderator" ? "bg-yellow-500/30 text-yellow-300" :
                          user.role === "banned" ? "bg-gray-500/30 text-gray-300" :
                          "bg-white/10 text-white/70"
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-white/50">{formatDate(user.createdAt)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          {user.role !== "owner" && (
                            <>
                              {user.role === "banned" ? (
                                <button
                                  type="button"
                                  onClick={() => performAction("/api/admin/users", { action: "unban", userId: user.id })}
                                  disabled={!!actionLoading}
                                  className="text-xs px-2 py-1 rounded bg-teal-500/20 text-teal-400 hover:bg-teal-500/30"
                                >
                                  Unban
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => performAction("/api/admin/users", { action: "ban", userId: user.id })}
                                  disabled={!!actionLoading}
                                  className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                >
                                  Ban
                                </button>
                              )}
                              <select
                                className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20"
                                value={user.role}
                                onChange={(e) => performAction("/api/admin/users", { action: "set_role", userId: user.id, role: e.target.value })}
                                disabled={!!actionLoading}
                              >
                                <option value="user">User</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                                <option value="owner">Owner</option>
                              </select>
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
          <div className="shell-panel p-3 lg:p-4">
            <h2 className="text-lg font-semibold">Activity Moderation</h2>
            <div className="mt-3 space-y-2">
              {activities.length === 0 ? (
                <p className="text-white/50 text-sm">No activities yet</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-xs text-white/50">
                        {activity.location} • by {activity.creatorName ?? "Unknown"} • {activity.going}/{activity.limit ?? "∞"} going
                      </p>
                      <p className="text-xs text-white/40">{formatDate(activity.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this activity? This cannot be undone.")) {
                          performAction("/api/admin/activities", { action: "delete", activityId: activity.id });
                        }
                      }}
                      disabled={!!actionLoading}
                      className="text-xs px-3 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}