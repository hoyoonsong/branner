import { Router } from "express";
import { requireApproved } from "../auth.js";

export const geoRouter = Router();
geoRouter.use(requireApproved);

type Place = { label: string; lat: number; lng: number };

async function searchNominatim(q: string): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BrannerHall/1.0 (hoyoon@stanford.edu)",
      Accept: "application/json",
    },
  });
  if (!response.ok) return [];
  const raw = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}

async function searchPhoton(q: string): Promise<Place[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  const raw = (await response.json()) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: { name?: string; street?: string; city?: string; state?: string; country?: string };
    }[];
  };
  return (raw.features ?? []).map((f) => {
    const p = f.properties;
    const label = [p.name || p.street, p.city, p.state, p.country].filter(Boolean).join(", ");
    return { label, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
  });
}

geoRouter.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    res.json({ results: [] });
    return;
  }
  try {
    let results = await searchNominatim(q);
    if (results.length === 0) results = await searchPhoton(q);
    res.json({ results });
  } catch {
    try {
      res.json({ results: await searchPhoton(q) });
    } catch {
      res.status(502).json({ error: "Place search failed" });
    }
  }
});
