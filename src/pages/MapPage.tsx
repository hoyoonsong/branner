import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { isRa, type Resident } from "../lib/types";
import {
  buildingForFloor,
  corridorsForFloor,
  spotsForFloor,
  type RoomSpot,
} from "../data/rooms";
import { clsx, fullName } from "../lib/utils";
import { Avatar, RaBadge } from "./Residents";

const HALL_FILL: Record<string, string> = {
  "Banana Treats": "#FFF6EC",
  "Savannah Bananas": "#F3F7FF",
  "Banana Cartoons": "#F3FAF4",
  "Banana Republic": "#FBF3F7",
  Lounge: "#FDECEC",
};

export function MapPage() {
  const [floor, setFloor] = useState<1 | 2 | 3>(1);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api<{ residents: Resident[] }>("/api/residents").then((d) =>
      setResidents(d.residents),
    );
  }, []);

  const byRoom = useMemo(() => {
    const m = new Map<string, Resident[]>();
    for (const r of residents) {
      const list = m.get(r.room) ?? [];
      list.push(r);
      m.set(r.room, list);
    }
    return m;
  }, [residents]);

  const spots = spotsForFloor(floor);
  const corridors = corridorsForFloor(floor);
  const building = buildingForFloor(floor);
  const picked = selected ? (byRoom.get(selected) ?? []) : [];
  const selectedSpot = spots.find((s) => s.room === selected);
  const view = useMemo(() => {
    const pad = 20;
    const bounds = ([1, 2, 3] as const).map((n) => {
      const boxes = [
        ...buildingForFloor(n),
        ...corridorsForFloor(n),
        ...spotsForFloor(n),
      ];
      const x = Math.min(...boxes.map((b) => b.x));
      const y = Math.min(...boxes.map((b) => b.y));
      return {
        x,
        y,
        w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
        h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
      };
    });
    const canvasW = Math.max(...bounds.map((b) => b.w)) + pad * 2;
    const canvasH = Math.max(...bounds.map((b) => b.h)) + pad * 2;
    const here = bounds[floor - 1];
    return {
      x: here.x - (canvasW - here.w) / 2,
      y: here.y - pad,
      w: canvasW,
      h: canvasH,
    };
  }, [floor]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Branner map</h1>
        </div>
        <div className="flex rounded-lg bg-white p-1 shadow-sm">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setFloor(n);
                setSelected(null);
              }}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                floor === n ? "bg-cardinal text-white" : "text-stone-mute",
              )}
            >
              Floor {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-[480px] overflow-hidden rounded-2xl bg-white p-4 shadow-sm">
        <svg
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMin meet"
          className="h-full w-full"
        >
          {building.map((b, i) => (
            <rect
              key={`b-${i}`}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx="10"
              fill="#F3E9E1"
              stroke="#D8C8B8"
            />
          ))}
          {corridors.map((c, i) => (
            <rect
              key={`c-${i}`}
              x={c.x}
              y={c.y}
              width={c.w}
              height={c.h}
              rx="3"
              fill="#E8D8CC"
            />
          ))}
          {spots.map((spot) => (
            <RoomCell
              key={spot.room}
              spot={spot}
              people={byRoom.get(spot.room) ?? []}
              active={selected === spot.room}
              onSelect={() => {
                if (spot.kind === "amenity") return;
                setSelected(spot.room);
              }}
            />
          ))}
        </svg>
      </div>

      {selected && selectedSpot && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl">
            {selectedSpot.kind === "lounge" ? "100 Lounge" : `Room ${selected}`}
          </h2>
          <p className="text-sm text-stone-mute">
            {picked[0]?.hall || selectedSpot.hall}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[...picked]
              .sort((a, b) => Number(isRa(b)) - Number(isRa(a)))
              .map((r) => (
              <Link
                key={r.id}
                to={`/residents/${r.id}`}
                className={clsx(
                  "flex items-center gap-3 rounded-xl p-2 hover:bg-stone-sand",
                  isRa(r) && "bg-amber-50 ring-1 ring-amber-300",
                )}
              >
                <Avatar resident={r} size={48} />
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {fullName(r)}
                    {isRa(r) && <RaBadge />}
                  </p>
                  <p className="text-xs text-stone-mute">
                    {r.bedSlot}
                    {isRa(r) ? " · Resident Assistant" : ""}
                  </p>
                </div>
              </Link>
            ))}
            {picked.length === 0 && (
              <p className="text-sm text-stone-mute">
                No one listed in this room.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoomCell({
  spot,
  people,
  active,
  onSelect,
}: {
  spot: RoomSpot;
  people: Resident[];
  active: boolean;
  onSelect: () => void;
}) {
  const amenity = spot.kind === "amenity";
  const lounge = spot.kind === "lounge";
  const hasRa = people.some((p) => isRa(p));
  const fill = active
    ? hasRa
      ? "#B45309"
      : "#8C1515"
    : amenity
      ? "#EDE7DF"
      : hasRa
        ? "#FFF7E6"
        : (HALL_FILL[spot.hall] ?? "white");
  return (
    <g onClick={onSelect} className={amenity ? undefined : "cursor-pointer"}>
      <rect
        x={spot.x}
        y={spot.y}
        width={spot.w}
        height={spot.h}
        rx={lounge ? 8 : 5}
        fill={fill}
        stroke={active ? (hasRa ? "#92400E" : "#6B1010") : hasRa ? "#D97706" : "#C4B6A6"}
        strokeWidth={hasRa ? 2 : 1}
      />
      <text
        x={spot.x + spot.w / 2}
        y={spot.y + spot.h / 2 + (lounge ? -3 : amenity ? -2 : 3)}
        textAnchor="middle"
        fontSize={lounge ? 12 : amenity ? 8 : 10}
        fontWeight={600}
        fill={active ? "white" : amenity ? "#6B6560" : "#2E2D29"}
      >
        {amenity ? (spot.label ?? spot.room) : spot.room}
      </text>
      {lounge && (
        <text
          x={spot.x + spot.w / 2}
          y={spot.y + spot.h / 2 + 12}
          textAnchor="middle"
          fontSize="9"
          fill={active ? "white" : "#8C1515"}
        >
          Lounge
        </text>
      )}
      {amenity && spot.label && spot.label !== spot.room && (
        <text
          x={spot.x + spot.w / 2}
          y={spot.y + spot.h / 2 + 8}
          textAnchor="middle"
          fontSize="7"
          fill="#6B6560"
        >
          {spot.room}
        </text>
      )}
      {!amenity && hasRa && (
        <text
          x={spot.x + 4}
          y={spot.y + 10}
          fontSize="8"
          fill={active ? "white" : "#B45309"}
        >
          RA
        </text>
      )}
      {!amenity && people.length > 0 && (
        <text
          x={spot.x + spot.w - 4}
          y={spot.y + 10}
          textAnchor="end"
          fontSize="8"
          fill={active ? "white" : hasRa ? "#B45309" : "#8C1515"}
        >
          {people.length}
        </text>
      )}
    </g>
  );
}
