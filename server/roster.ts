export function isRa(type: string | null | undefined): boolean {
  return (type ?? "").trim().toUpperCase() === "RA";
}

export function isHouseMeeting(
  eventType?: { slug?: string | null; label?: string | null } | null,
): boolean {
  if (!eventType) return false;
  const slug = (eventType.slug ?? "").toLowerCase();
  return slug === "house-meeting" || /house\s*meeting/i.test(eventType.label ?? "");
}

export function eventIsHouseMeeting(event: {
  houseMeeting?: boolean | null;
  eventType?: { slug?: string | null; label?: string | null } | null;
}): boolean {
  if (typeof event.houseMeeting === "boolean") return event.houseMeeting;
  return isHouseMeeting(event.eventType);
}
