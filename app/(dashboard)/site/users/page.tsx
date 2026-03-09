"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useToast } from "@/components/toast-provider";

type ManagedUser = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  imageUrl: string;
  banned: boolean;
  locked: boolean;
  createdAt: number;
  lastSignInAt: number | null;
  allowlisted: boolean;
  admin: boolean;
  reportStaff: boolean;
  metadataAdmin: boolean;
  metadataReportStaff: boolean;
};

type UsersResponse = {
  users: ManagedUser[];
};

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) => {
      const haystack = `${user.name} ${user.email ?? ""} ${user.username ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, users]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as UsersResponse;
      setUsers(data.users ?? []);
    } catch (error) {
      const message = (error as Error).message || "Unable to load users.";
      setStatusMessage(message);
      toast({ title: "Unable to load users", description: message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function setPendingFor(id: string, value: boolean) {
    setPending((current) => ({ ...current, [id]: value }));
  }

  async function updateRoles(user: ManagedUser, patch: { admin?: boolean; reportStaff?: boolean }) {
    setPendingFor(user.id, true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await loadUsers();
      toast({ title: "User access updated", description: user.email ?? user.name, variant: "success" });
    } catch (error) {
      toast({ title: "Unable to update access", description: (error as Error).message, variant: "error" });
    } finally {
      setPendingFor(user.id, false);
    }
  }

  async function performAction(user: ManagedUser, action: "lock" | "unlock" | "force_password_reset") {
    setPendingFor(user.id, true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await loadUsers();
      const title =
        action === "force_password_reset"
          ? "Password reset required"
          : action === "lock"
          ? "Account locked"
          : "Account unlocked";
      toast({ title, description: user.email ?? user.name, variant: "warning" });
    } catch (error) {
      toast({ title: "Unable to update account", description: (error as Error).message, variant: "error" });
    } finally {
      setPendingFor(user.id, false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="panel-strong p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Users</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-oxford-700 md:text-4xl">User Management</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
          Manage users and access roles.
        </p>
      </div>

      <SignedOut>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold uppercase tracking-[0.08em]">Sign in required</p>
          <p className="mt-2">You need to sign in to manage users.</p>
          <SignInButton>
            <button
              className="mt-4 rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600"
              type="button"
            >
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="panel p-4 md:p-5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users by name, username, or email..."
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-oxford-700 outline-none transition placeholder:text-slate-500 focus:border-oxford-700 focus:ring-2 focus:ring-[var(--ring-soft)]"
            aria-label="Search users"
          />
        </div>

        {statusMessage && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{statusMessage}</p>
        )}

        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-slate-600">Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <div className="panel p-6">
              <p className="text-sm text-slate-600">No users matched your search.</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isBusy = pending[user.id] === true;
              const accountStatus = user.locked ? "Locked" : "Active";
              return (
                <article key={user.id} className="panel p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-oxford-700">{user.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{user.email ?? "No email"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-slate-600">
                          {accountStatus}
                        </span>
                        {user.allowlisted && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                            Allowlisted
                          </span>
                        )}
                        {user.admin && (
                          <span className="rounded-full border border-oxford-200 bg-oxford-50 px-2 py-1 text-oxford-700">
                            Admin Access
                          </span>
                        )}
                        {user.reportStaff && (
                          <span className="rounded-full border border-deepforest-200 bg-deepforest-50 px-2 py-1 text-deepforest-700">
                            Report Staff
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid w-full gap-3 md:w-auto md:min-w-[320px]">
                      <label className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <span>Admin Features</span>
                        <input
                          type="checkbox"
                          checked={user.metadataAdmin}
                          disabled={isBusy || user.allowlisted}
                          onChange={(event) => updateRoles(user, { admin: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
                        />
                      </label>
                      <label className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <span>Reports Staff</span>
                        <input
                          type="checkbox"
                          checked={user.metadataReportStaff}
                          disabled={isBusy}
                          onChange={(event) => updateRoles(user, { reportStaff: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => performAction(user, user.locked ? "unlock" : "lock")}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-oxford-700 transition hover:border-oxford-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {user.locked ? "Unlock Account" : "Lock Account"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => performAction(user, "force_password_reset")}
                          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Require Password Reset
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </SignedIn>
    </section>
  );
}
