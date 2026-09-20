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

  return (
    <div>
      <h1 className="font-display text-3xl">Admins</h1>
      <p className="mt-1 text-sm text-stone-mute">Approve who can open the staff tools.</p>
      <div className="mt-6 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
        {admins.map((a) => (
          <div key={a.id} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1">
              <p className="font-medium">{a.name}</p>
              <p className="text-sm text-stone-mute">{a.email}</p>
            </div>
            <span className="text-xs uppercase tracking-wide text-stone-mute">{a.status}</span>
            {a.status !== "approved" && (
              <button type="button" className="text-sm font-medium text-cardinal" onClick={() => setStatus(a.id, "approved")}>
                Approve
              </button>
            )}
            {a.status !== "rejected" && (
              <button type="button" className="text-sm text-stone-mute" onClick={() => setStatus(a.id, "rejected")}>
                Reject
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
