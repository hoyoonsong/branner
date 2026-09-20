import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Resident } from "../lib/types";
import { fullName } from "../lib/utils";
import { Avatar } from "./Residents";

export function ResidentProfile() {
  const { id } = useParams();
  const [resident, setResident] = useState<Resident | null>(null);
  const [roommates, setRoommates] = useState<Resident[]>([]);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!id) return;
    api<{ resident: Resident; roommates: Resident[] }>(`/api/residents/${id}`).then((d) => {
      setResident(d.resident);
      setRoommates(d.roommates);
      setNotes(d.resident.notes);
    });
  }, [id]);

  if (!resident) return <p className="text-stone-mute">Loading…</p>;

  const save = async () => {
    await api(`/api/residents/${resident.id}`, { method: "PATCH", body: JSON.stringify({ notes }) });
    setSaved("Saved");
    setTimeout(() => setSaved(""), 1500);
  };

  return (
    <div className="max-w-3xl">
      <Link to="/residents" className="text-sm text-cardinal">
        ← Residents
      </Link>
      <div className="mt-4 flex gap-5 rounded-2xl bg-white p-6 shadow-sm">
        <Avatar resident={resident} size={112} />
        <div>
          <h1 className="font-display text-3xl">{fullName(resident)}</h1>
          <p className="text-stone-mute">
            {resident.type} · {resident.hall}
          </p>
          <p className="mt-1 text-sm">
            Room {resident.bedSlot} ({resident.room})
          </p>
          <p className="text-sm">{resident.email}</p>
        </div>
      </div>
      <dl className="mt-6 grid gap-3 rounded-2xl bg-white p-6 text-sm shadow-sm sm:grid-cols-2">
        <Item k="Hometown" v={resident.hometown} />
        <Item k="Country" v={resident.country} />
        <Item k="Phone" v={resident.phone} />
        <Item k="Check-in" v={resident.checkIn} />
        <Item k="Early arrival" v={resident.earlyArrival} />
        <Item k="T-shirt" v={resident.tshirtSize} />
      </dl>
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl">Roommates</h2>
        <div className="mt-3 space-y-2">
          {roommates.length === 0 && <p className="text-sm text-stone-mute">No roommates listed.</p>}
          {roommates.map((r) => (
            <Link key={r.id} to={`/residents/${r.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-stone-sand">
              <Avatar resident={r} size={36} />
              <span>
                {fullName(r)} · {r.bedSlot}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl">Staff notes</h2>
        <textarea
          className="mt-3 min-h-[140px] w-full rounded-lg border border-black/10 p-3 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={save} className="rounded-lg bg-cardinal px-4 py-2 text-sm font-semibold text-white">
            Save notes
          </button>
          {saved && <span className="text-sm text-emerald-700">{saved}</span>}
        </div>
      </section>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-mute">{k}</dt>
      <dd>{v || "—"}</dd>
    </div>
  );
}
