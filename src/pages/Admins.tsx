import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { STAFF_PAGES, type AdminRole, type StaffPageId } from "../lib/permissions";
import type { AdminUser } from "../lib/types";

type AdminPatch = {
  status?: string;
  role?: AdminRole;
  pages?: StaffPageId[];
};

export function Admins() {
  const { user, refresh } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const load = () =>
    api<{ admins: AdminUser[] }>("/api/auth/admins").then((d) => setAdmins(d.admins));
  useEffect(() => {
    load().catch(console.error);
  }, []);

  const update = async (id: string, patch: AdminPatch) => {
    setError("");
    try {
      await api(`/api/auth/admins/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
      if (user?.id === id) await refresh();
    } catch (err) {
      setError((err as Error).message);
      load().catch(console.error);
    }
  };

  const visible = admins.filter((admin) => admin.status !== "rejected");
  const rejected = admins.filter((admin) => admin.status === "rejected");

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl">Admins</h1>
      <p className="mt-1 text-sm text-stone-mute">
        Approve staff. Admins can open every page. Student leaders only get the pages you check.
      </p>
      {error && <p className="mt-4 text-sm text-cardinal">{error}</p>}
      <div className="mt-6 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
        {visible.map((admin) => (
          <AdminRow key={admin.id} admin={admin} onUpdate={update} />
        ))}
        {visible.length === 0 && (
          <p className="px-4 py-5 text-sm text-stone-mute sm:px-5">No pending or approved admins.</p>
        )}
      </div>

      {rejected.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl">Rejected</h2>
          <p className="mt-1 text-sm text-stone-mute">
            These people are hidden above. Approve one to let them back in.
          </p>
          <div className="mt-4 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
            {rejected.map((admin) => (
              <AdminRow key={admin.id} admin={admin} onUpdate={update} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AdminRow({
  admin,
  onUpdate,
}: {
  admin: AdminUser;
  onUpdate: (id: string, patch: AdminPatch) => void;
}) {
  const role = admin.role === "student_leader" ? "student_leader" : "admin";
  const pages = new Set(admin.pages ?? []);

  const togglePage = (pageId: StaffPageId) => {
    const next = new Set(pages);
    if (next.has(pageId)) next.delete(pageId);
    else next.add(pageId);
    onUpdate(
      admin.id,
      { pages: STAFF_PAGES.map((page) => page.id).filter((id) => next.has(id)) },
    );
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{admin.name}</p>
          <p className="break-all text-sm text-stone-mute">{admin.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {admin.status === "approved" && (
            <label className="text-sm">
              <span className="sr-only">Role for {admin.name}</span>
              <select
                value={role}
                onChange={(event) => onUpdate(admin.id, { role: event.target.value as AdminRole })}
                className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm"
              >
                <option value="admin">Admin</option>
                <option value="student_leader">Student leader</option>
              </select>
            </label>
          )}
          <span className="text-xs uppercase tracking-wide text-stone-mute">{admin.status}</span>
          {admin.status !== "approved" && (
            <button
              type="button"
              className="text-sm font-medium text-cardinal"
              onClick={() => onUpdate(admin.id, { status: "approved" })}
            >
              Approve
            </button>
          )}
          {admin.status !== "rejected" && (
            <button
              type="button"
              className="text-sm text-stone-mute"
              onClick={() => onUpdate(admin.id, { status: "rejected" })}
            >
              Reject
            </button>
          )}
        </div>
      </div>
      {admin.status === "approved" && role === "student_leader" && (
        <div className="border-t border-black/5 pt-3">
          <p className="text-xs uppercase tracking-wide text-stone-mute">Pages they can open</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="Pages they can open">
            {STAFF_PAGES.map((page) => (
              <label key={page.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-cardinal"
                  checked={pages.has(page.id)}
                  onChange={() => togglePage(page.id)}
                />
                {page.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
