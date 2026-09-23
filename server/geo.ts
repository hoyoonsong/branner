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

export const BRANNER_LAT = Number(process.env.BRANNER_LAT ?? 37.4274);
export const BRANNER_LNG = Number(process.env.BRANNER_LNG ?? -122.1647);

/** Indoor phones often report tens of meters of error. Don't reject a fix that could still be inside the event. */
const GPS_SLACK_CAP_M = 150;

export function isNearEvent(distanceM: number, radiusM: number, accuracyM?: number | null): boolean {
  const accuracy = accuracyM != null && Number.isFinite(accuracyM) ? Math.max(0, accuracyM) : 80;
  const slack = Math.min(accuracy, GPS_SLACK_CAP_M);
  return distanceM <= radiusM + slack;
}
