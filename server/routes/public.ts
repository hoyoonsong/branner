import { Router } from "express";
import { prisma } from "../prisma.js";
import { currentIdentity } from "../auth.js";
import { haversineMeters } from "../geo.js";
import { matchResidentByName, normName } from "../names.js";

export const publicRouter = Router();

publicRouter.get("/events/:slug", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: { eventType: true },
  });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const identity = currentIdentity(req);
  const resident = identity
    ? await prisma.resident.findUnique({ where: { email: identity.email } })
    : null;
  res.json({
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      requireLogin: event.requireLogin,
      locationTracking: event.locationTracking,
      lat: event.lat,
      lng: event.lng,
      radiusMeters: event.radiusMeters,
      formSchema: JSON.parse(event.formSchema),
      eventType: event.eventType,
    },
    identity: resident
      ? {
          email: resident.email,
          name: `${resident.firstName} ${resident.lastName}`,
          resident: {
            id: resident.id,
            firstName: resident.firstName,
            lastName: resident.lastName,
            room: resident.room,
            hall: resident.hall,
            photoPath: resident.photoPath,
            type: resident.type,
          },
        }
      : identity
        ? { email: identity.email, name: identity.name, resident: null }
        : null,
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    allowDevLogin: process.env.ALLOW_DEV_LOGIN === "1" || !process.env.GOOGLE_CLIENT_ID,
  });
});

publicRouter.post("/events/:slug/submit", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const identity = currentIdentity(req);
  const firstName = String(req.body?.firstName ?? "").trim();
  const lastName = String(req.body?.lastName ?? "").trim();
  const guestName = `${firstName} ${lastName}`.trim();

  let resident = identity
    ? await prisma.resident.findUnique({ where: { email: identity.email } })
    : null;

  if (event.requireLogin) {
    if (!identity) {
      res.status(401).json({ error: "Sign in with Stanford to check in" });
      return;
    }
    if (!resident) {
      res.status(403).json({ error: "Your Stanford email is not on the Branner roster" });
      return;
    }
  } else {
    if (!guestName) {
      res.status(400).json({ error: "Enter your first and last name" });
      return;
    }
    const roster = await prisma.resident.findMany({
      select: { id: true, firstName: true, lastName: true, legalName: true },
    });
    const matched = matchResidentByName(firstName, lastName, roster);
    resident = matched
      ? await prisma.resident.findUnique({ where: { id: matched.id } })
      : null;
  }

  let distanceM: number | null = null;
  const gps = req.body?.gps as { lat?: number; lng?: number; accuracy?: number } | undefined;
  const rawLat = req.body?.lat ?? gps?.lat;
  const rawLng = req.body?.lng ?? gps?.lng;
  const lat = rawLat == null || rawLat === "" ? null : Number(rawLat);
  const lng = rawLng == null || rawLng === "" ? null : Number(rawLng);
  const accuracyRaw = req.body?.accuracy ?? gps?.accuracy;
  const accuracy = accuracyRaw == null || accuracyRaw === "" ? null : Number(accuracyRaw);
  const answers = req.body?.answers ?? req.body?.responseData ?? {};

  if (event.locationTracking) {
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400).json({ error: "Location required" });
      return;
    }
    if (event.lat == null || event.lng == null) {
      res.status(400).json({ error: "Event location is not set" });
      return;
    }
    distanceM = haversineMeters(lat, lng, event.lat, event.lng);
    if (distanceM > event.radiusMeters) {
      res.status(400).json({
        error: `Too far from the event (${Math.round(distanceM)} m, need ${event.radiusMeters} m)`,
        distanceM,
      });
      return;
    }
  }

  const payload = {
    responseData: JSON.stringify(answers),
    lat,
    lng,
    accuracy,
    distanceM,
    status: "present",
    guestName: resident ? null : guestName || null,
  };

  const submission = resident
    ? await prisma.submission.upsert({
        where: { eventId_residentId: { eventId: event.id, residentId: resident.id } },
        create: {
          eventId: event.id,
          residentId: resident.id,
          ...payload,
        },
        update: payload,
      })
    : await upsertGuestSubmission(event.id, guestName, payload);

  res.json({
    ok: true,
    submissionId: submission.id,
    distanceM,
    resident: resident
      ? {
          id: resident.id,
          firstName: resident.firstName,
          lastName: resident.lastName,
          room: resident.room,
          hall: resident.hall,
        }
      : null,
    guestName: resident ? null : guestName,
  });
});

async function upsertGuestSubmission(
  eventId: string,
  guestName: string,
  payload: {
    responseData: string;
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    distanceM: number | null;
    status: string;
    guestName: string | null;
  },
) {
  const existing = await prisma.submission.findMany({
    where: { eventId, residentId: null },
  });
  const prior = existing.find((row) => normName(row.guestName ?? "") === normName(guestName));
  if (prior) {
    return prisma.submission.update({
      where: { id: prior.id },
      data: payload,
    });
  }
  return prisma.submission.create({
    data: {
      eventId,
      residentId: null,
      ...payload,
    },
  });
}
