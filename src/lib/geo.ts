export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const BRANNER_LAT = 37.4274;
export const BRANNER_LNG = -122.1647;

/** Indoor phones often report tens of meters of error. Don't reject a fix that could still be inside the event. */
const GPS_SLACK_CAP_M = 150;

export function isNearEvent(distanceM: number, radiusM: number, accuracyM?: number | null): boolean {
  const accuracy = accuracyM != null && Number.isFinite(accuracyM) ? Math.max(0, accuracyM) : 80;
  const slack = Math.min(accuracy, GPS_SLACK_CAP_M);
  return distanceM <= radiusM + slack;
}

export function destinationPoint(
  lat: number,
  lng: number,
  meters: number,
  bearingDeg: number,
): [number, number] {
  const R = 6371000;
  const br = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const δ = meters / R;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(br));
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(br) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
}
