import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AdminUser } from "../lib/types";

export function Admins() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const load = () =>
    api<{ admins: AdminUser[] }>("/api/auth/admins").then((d) => setAdmins(d.admins));
  useEffect(() => {
    load().catch(console.error);
  }, []);

  const setStatus = async (id: string, status: string) => {
    await api(`/api/auth/admins/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load().catch(console.error);
  };

  const visible = admins.filter((admin) => admin.status !== "rejected");
  const rejected = admins.filter((admin) => admin.status === "rejected");

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl">Admins</h1>
      <p className="mt-1 text-sm text-stone-mute">Approve who can open the staff tools.</p>
      <div className="mt-6 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
        {visible.map((admin) => (
          <AdminRow key={admin.id} admin={admin} onStatus={setStatus} />
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
              <AdminRow key={admin.id} admin={admin} onStatus={setStatus} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AdminRow({
  admin,
  onStatus,
}: {
  admin: AdminUser;
  onStatus: (id: string, status: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{admin.name}</p>
        <p className="break-all text-sm text-stone-mute">{admin.email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-stone-mute">{admin.status}</span>
        {admin.status !== "approved" && (
          <button
            type="button"
            className="text-sm font-medium text-cardinal"
            onClick={() => onStatus(admin.id, "approved")}
          >
            Approve
          </button>
        )}
        {admin.status !== "rejected" && (
          <button
            type="button"
            className="text-sm text-stone-mute"
            onClick={() => onStatus(admin.id, "rejected")}
          >
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
