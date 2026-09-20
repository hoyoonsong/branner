import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { isRa, type Resident } from "../lib/types";
import { clsx, fullName } from "../lib/utils";

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

  const ras = useMemo(() => residents.filter((r) => isRa(r)), [residents]);
  const others = useMemo(() => residents.filter((r) => !isRa(r)), [residents]);

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

      {ras.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">Resident Assistants</h2>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">{ras.length} RAs</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ras.map((r) => (
              <ResidentLink key={r.id} resident={r} />
            ))}
          </div>
        </section>
      )}

      <section className={ras.length > 0 ? "mt-8" : "mt-6"}>
        {ras.length > 0 && <h2 className="font-display text-xl">Residents</h2>}
        <div className={clsx("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", ras.length > 0 && "mt-3")}>
          {others.map((r) => (
            <ResidentLink key={r.id} resident={r} />
          ))}
        </div>
      </section>

      {residents.length === 0 && (
        <p className="mt-8 text-sm text-stone-mute">No residents yet. Run the roster import.</p>
      )}
    </div>
  );
}

function ResidentLink({ resident }: { resident: Resident }) {
  const ra = isRa(resident);
  return (
    <Link
      to={`/residents/${resident.id}`}
      className={clsx(
        "flex gap-3 rounded-2xl p-3 shadow-sm hover:shadow",
        ra ? "bg-amber-50 ring-2 ring-amber-400" : "bg-white",
      )}
    >
      <Avatar resident={resident} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {fullName(resident)}
          {ra && <RaBadge />}
        </p>
        <p className="text-sm text-stone-mute">
          {resident.room} · {resident.hall}
        </p>
        <p className="truncate text-xs text-stone-mute">{resident.email}</p>
      </div>
    </Link>
  );
}

export function RaBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
      RA
    </span>
  );
}

export function Avatar({
  resident,
  size = 48,
}: {
  resident: Pick<Resident, "photoPath" | "firstName" | "lastName"> & { type?: string | null };
  size?: number;
}) {
  const ra = isRa(resident);
  const radius = size >= 80 ? "rounded-2xl" : "rounded-xl";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={clsx("h-full w-full overflow-hidden", radius, ra && "ring-2 ring-amber-400 ring-offset-1")}
      >
        {resident.photoPath ? (
          <img src={resident.photoPath} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className={clsx(
              "grid h-full w-full place-items-center text-sm font-semibold",
              ra ? "bg-amber-100 text-amber-800" : "bg-cardinal/10 text-cardinal",
            )}
          >
            {resident.firstName[0]}
            {resident.lastName?.[0] ?? ""}
          </div>
        )}
      </div>
      {ra && (
        <span
          className={clsx(
            "absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 font-bold uppercase tracking-wide text-white shadow-sm",
            size >= 64 ? "px-1.5 py-0.5 text-[10px]" : "px-1 py-px text-[8px]",
          )}
        >
          RA
        </span>
      )}
    </div>
  );
}
