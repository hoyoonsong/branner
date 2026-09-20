import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireApproved } from "../auth.js";
import { BRANNER_LAT, BRANNER_LNG } from "../geo.js";
import { eventIsHouseMeeting, isHouseMeeting, isRa } from "../roster.js";
import { slugify, uniqueSlug } from "../slug.js";

export const eventsRouter = Router();
eventsRouter.use(requireApproved);

const defaultFormSchema = JSON.stringify({
  fields: [
    {
      id: "notes",
      type: "textarea",
      label: "Anything we should know?",
      required: false,
      placeholder: "Optional",
    },
  ],
});

eventsRouter.get("/types", async (_req, res) => {
  const types = await prisma.eventType.findMany({ orderBy: { label: "asc" } });
  res.json({ types });
});

eventsRouter.post("/types", async (req, res) => {
  const label = String(req.body?.label ?? "").trim();
  if (!label) {
    res.status(400).json({ error: "Label required" });
    return;
  }
  const slug = slugify(label);
  const existing = await prisma.eventType.findUnique({ where: { slug } });
  if (existing) {
    res.json({ type: existing });
    return;
  }
  const type = await prisma.eventType.create({ data: { label, slug } });
  res.json({ type });
});

eventsRouter.get("/", async (_req, res) => {
  const events = await prisma.event.findMany({
    include: {
      eventType: true,
      submissions: { include: { resident: { select: { type: true } } } },
    },
    orderBy: { startsAt: "desc" },
  });
  res.json({
    events: events.map(({ submissions, ...event }) => ({
      ...event,
      _count: {
        submissions: countedSubmissions(event, submissions).length,
      },
    })),
  });
});

eventsRouter.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { eventType: true },
  });
  if (!event) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const submissions = await prisma.submission.findMany({
    where: { eventId: event.id },
    include: { resident: true },
    orderBy: { createdAt: "asc" },
  });
  const residents = await prisma.resident.findMany({
    where: { building: "Branner" },
    orderBy: [{ hall: "asc" }, { lastName: "asc" }],
  });
  const houseMeeting = eventIsHouseMeeting(event);
  const expected = houseMeeting ? residents.filter((r) => !isRa(r.type)) : residents;
  const visibleSubmissions = countedSubmissions(event, submissions);
  const presentIds = new Set(
    visibleSubmissions.map((s) => s.residentId).filter((id): id is string => Boolean(id)),
  );
  const absent = expected.filter((r) => !presentIds.has(r.id));
  const byHall: Record<string, { present: number; expected: number }> = {};
  for (const r of expected) {
    byHall[r.hall] ??= { present: 0, expected: 0 };
    byHall[r.hall].expected += 1;
    if (presentIds.has(r.id)) byHall[r.hall].present += 1;
  }
  res.json({
    event: { ...event, formSchema: JSON.parse(event.formSchema) },
    submissions: submissions.map((s) => ({
      ...s,
      responseData: JSON.parse(s.responseData),
    })),
    absent,
    analytics: {
      present: visibleSubmissions.length,
      expected: expected.length,
      absent: absent.length,
      byHall,
    },
  });
});

eventsRouter.post("/", async (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  const eventTypeId = String(req.body?.eventTypeId ?? "");
  const startsAt = req.body?.startsAt ? new Date(req.body.startsAt) : new Date();
  if (!title || !eventTypeId) {
    res.status(400).json({ error: "Title and type required" });
    return;
  }
  const type = await prisma.eventType.findUnique({ where: { id: eventTypeId } });
  if (!type) {
    res.status(400).json({ error: "Unknown event type" });
    return;
  }
  const locationTracking = Boolean(req.body?.locationTracking ?? true);
  const houseMeeting =
    req.body?.houseMeeting != null ? Boolean(req.body.houseMeeting) : eventIsHouseMeeting({ eventType: type });
  const event = await prisma.event.create({
    data: {
      title,
      eventTypeId,
      startsAt,
      endsAt: req.body?.endsAt ? new Date(req.body.endsAt) : null,
      requireLogin: req.body?.requireLogin !== false,
      locationTracking,
      houseMeeting,
      oneResponse: req.body?.oneResponse !== false,
      lat: locationTracking ? Number(req.body?.lat ?? BRANNER_LAT) : null,
      lng: locationTracking ? Number(req.body?.lng ?? BRANNER_LNG) : null,
      radiusMeters: locationTracking ? Number(req.body?.radiusMeters ?? 80) : 80,
      formSchema: req.body?.formSchema
        ? JSON.stringify(req.body.formSchema)
        : defaultFormSchema,
      slug: uniqueSlug(title, Date.now().toString(36)),
    },
    include: { eventType: true },
  });
  res.json({ event: { ...event, formSchema: JSON.parse(event.formSchema) } });
});

eventsRouter.patch("/:id", async (req, res) => {
  const data: Record<string, unknown> = {};
  if (req.body.title != null) data.title = String(req.body.title);
  if (req.body.eventTypeId != null) {
    data.eventTypeId = String(req.body.eventTypeId);
    if (req.body.houseMeeting == null) {
      const nextType = await prisma.eventType.findUnique({ where: { id: String(req.body.eventTypeId) } });
      if (nextType) data.houseMeeting = isHouseMeeting(nextType);
    }
  }
  if (req.body.startsAt != null) data.startsAt = new Date(req.body.startsAt);
  if (req.body.endsAt !== undefined)
    data.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
  if (req.body.requireLogin != null) data.requireLogin = Boolean(req.body.requireLogin);
  if (req.body.locationTracking != null)
    data.locationTracking = Boolean(req.body.locationTracking);
  if (req.body.houseMeeting != null) data.houseMeeting = Boolean(req.body.houseMeeting);
  if (req.body.oneResponse != null) data.oneResponse = Boolean(req.body.oneResponse);
  if (req.body.lat !== undefined) data.lat = req.body.lat == null || req.body.lat === "" ? null : Number(req.body.lat);
  if (req.body.lng !== undefined) data.lng = req.body.lng == null || req.body.lng === "" ? null : Number(req.body.lng);
  if (req.body.radiusMeters != null) data.radiusMeters = Number(req.body.radiusMeters);
  if (req.body.formSchema != null) data.formSchema = JSON.stringify(req.body.formSchema);
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data,
    include: { eventType: true },
  });
  res.json({ event: { ...event, formSchema: JSON.parse(event.formSchema) } });
});

eventsRouter.delete("/:id", async (req, res) => {
  await prisma.event.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

function countedSubmissions<
  T extends { resident?: { type?: string | null } | null; residentId?: string | null },
>(
  event: {
    houseMeeting?: boolean | null;
    eventType?: { slug?: string | null; label?: string | null } | null;
  },
  submissions: T[],
): T[] {
  if (!eventIsHouseMeeting(event)) return submissions;
  return submissions.filter((s) => !isRa(s.resident?.type));
}
