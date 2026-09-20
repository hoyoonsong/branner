import { useEffect, useRef, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { api } from "../lib/api";
import { destinationPoint, haversineMeters } from "../lib/geo";

const pin = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:999px;background:#8C1515;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const handleIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:999px;background:white;border:3px solid #8C1515;box-shadow:0 1px 6px rgba(0,0,0,.35)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

type Place = { label: string; lat: number; lng: number };

function ClickSet({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function InvalidateOnce() {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(t);
  }, [map]);
  return null;
}

function Recenter({ lat, lng, token }: { lat: number; lng: number; token: number }) {
  const map = useMap();
  useEffect(() => {
    if (!token) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.45 });
    map.invalidateSize();
  }, [token, lat, lng, map]);
  return null;
}

function FitCircle({ lat, lng, radiusMeters, token }: { lat: number; lng: number; radiusMeters: number; token: number }) {
  const map = useMap();
  useEffect(() => {
    if (!token) return;
    const bounds = L.latLng(lat, lng).toBounds(Math.max(radiusMeters * 2.2, 80));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 18 });
  }, [token, lat, lng, radiusMeters, map]);
  return null;
}

export function EventLocationMap({
  lat,
  lng,
  radiusMeters,
  onChange,
  onRadiusChange,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
  onRadiusChange: (meters: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [focusToken, setFocusToken] = useState(0);
  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      setSearching(true);
      api<{ results: Place[] }>(`/api/geo/search?q=${encodeURIComponent(q)}`)
        .then((d) => setResults(d.results))
        .catch((err) => setError((err as Error).message))
        .finally(() => setSearching(false));
    }, 280);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [query]);

  const pick = (place: Place) => {
    onChange(place.lat, place.lng);
    setQuery(place.label);
    setResults([]);
    setFocusToken((n) => n + 1);
  };

  const useMyLocation = () => {
    setError("");
    if (!("geolocation" in navigator)) {
      setError("This browser cannot share a location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setFocusToken((n) => n + 1);
        setLocating(false);
        setQuery("Your location");
      },
      () => {
        setLocating(false);
        setError("Could not read your location. Allow GPS and try again.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const handlePos = destinationPoint(lat, lng, radiusMeters, 90);
  const radius = Math.max(15, Math.min(2000, Math.round(radiusMeters)));

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            placeholder="Search a place…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {(results.length > 0 || searching) && (
            <div className="absolute z-[500] mt-1 max-h-48 w-full overflow-auto rounded-lg border border-black/10 bg-white text-sm shadow-lg">
              {searching && <p className="px-3 py-2 text-stone-mute">Searching…</p>}
              {results.map((r) => (
                <button
                  key={`${r.lat},${r.lng},${r.label}`}
                  type="button"
                  className="block w-full truncate px-3 py-2 text-left hover:bg-stone-sand"
                  onClick={() => pick(r)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          className="rounded-lg bg-cardinal px-3 py-2 text-sm font-medium text-white"
        >
          {locating ? "Finding you…" : "Use my location"}
        </button>
      </div>
      <p className="text-xs text-stone-mute">
        Drag the red pin to move the check-in spot. Drag the white handle (or the slider) to draw the allowed radius.
      </p>
      <div className="h-72 overflow-hidden rounded-xl border border-black/10">
        <MapContainer center={[lat, lng]} zoom={17} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <InvalidateOnce />
          <ClickSet onChange={onChange} />
          <Recenter lat={lat} lng={lng} token={focusToken} />
          <FitCircle lat={lat} lng={lng} radiusMeters={radius} token={focusToken} />
          <Marker
            position={[lat, lng]}
            icon={pin}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                onChange(p.lat, p.lng);
              },
            }}
          />
          <Circle
            center={[lat, lng]}
            radius={radius}
            pathOptions={{ color: "#8C1515", fillColor: "#8C1515", fillOpacity: 0.16, weight: 2 }}
          />
          <Marker
            position={handlePos}
            icon={handleIcon}
            draggable
            eventHandlers={{
              drag: (e) => {
                const p = e.target.getLatLng();
                onRadiusChange(Math.max(15, Math.min(2000, Math.round(haversineMeters(lat, lng, p.lat, p.lng)))));
              },
              dragend: (e) => {
                const p = e.target.getLatLng();
                onRadiusChange(Math.max(15, Math.min(2000, Math.round(haversineMeters(lat, lng, p.lat, p.lng)))));
              },
            }}
          />
        </MapContainer>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="w-28 text-stone-mute">Radius {radius} m</span>
        <input
          type="range"
          min={15}
          max={800}
          step={5}
          value={Math.min(radius, 800)}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="flex-1 accent-cardinal"
        />
      </label>
      {error && <p className="text-sm text-cardinal">{error}</p>}
    </div>
  );
}
