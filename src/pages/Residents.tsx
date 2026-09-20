import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Resident } from "../lib/types";
import { fullName } from "../lib/utils";

export function Residents() {
  const [q, setQ] = useState("");
  const [hall, setHall] = useState("");
  const [residents, setResidents] = useState<Resident[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (hall) params.set("hall", hall);
      api<{ residents: Resident[] }>(`/api/residents?${params}`)
        .then((d) => setResidents(d.residents))
        .catch(console.error);
    }, 150);
    return () => clearTimeout(t);
  }, [q, hall]);

  const halls = [...new Set(residents.map((r) => r.hall).filter(Boolean))];

  return (
    <div>
      <h1 className="font-display text-3xl">Residents</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, room"
          className="w-64 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
        />
        <select
          value={hall}
          onChange={(e) => setHall(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
        >
          <option value="">All halls</option>
          {["Savannah Bananas", "Banana Treats", "Banana Cartoons", "Banana Republic"].map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {residents.map((r) => (
          <Link
            key={r.id}
            to={`/residents/${r.id}`}
            className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm hover:shadow"
          >
            <Avatar resident={r} />
            <div className="min-w-0">
              <p className="font-medium">{fullName(r)}</p>
              <p className="text-sm text-stone-mute">
                {r.room} · {r.hall}
              </p>
              <p className="truncate text-xs text-stone-mute">{r.email}</p>
            </div>
          </Link>
        ))}
      </div>
      {halls.length === 0 && residents.length === 0 && (
        <p className="mt-8 text-sm text-stone-mute">No residents yet. Run the roster import.</p>
      )}
    </div>
  );
}

export function Avatar({ resident, size = 48 }: { resident: Pick<Resident, "photoPath" | "firstName" | "lastName">; size?: number }) {
  if (resident.photoPath) {
    return (
      <img
        src={resident.photoPath}
        alt=""
        className="rounded-xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="grid place-items-center rounded-xl bg-cardinal/10 text-sm font-semibold text-cardinal"
      style={{ width: size, height: size }}
    >
      {resident.firstName[0]}
      {resident.lastName[0]}
    </div>
  );
}
