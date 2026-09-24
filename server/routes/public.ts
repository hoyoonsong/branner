import { Router, type Request, type Response } from "express";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { prisma } from "../prisma.js";
import { uploadsDir } from "../runtime.js";
import { currentIdentity } from "../auth.js";
import { haversineMeters, isNearEvent } from "../geo.js";
import { identityNameKeys, matchResidentByName, normName } from "../names.js";
import {
  attendanceStatus,
  formWasSubmitted,
  lateAtOf,
  parseResponseData,
  responseGateOf,
  submissionClosedMessage,
  submissionWindow,
} from "../attendance.js";

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
  const firstName = String(req.query.firstName ?? "").trim();
  const lastName = String(req.query.lastName ?? "").trim();
  const signedInResident = identity
    ? await prisma.resident.findUnique({ where: { email: identity.email } })
    : null;
  const oneResponse = event.oneResponse !== false;
  const browserCheckIn = oneResponse ? await checkInFromBrowser(req, event.id) : null;
  const existing =
    browserCheckIn ??
    (oneResponse
      ? await findExistingCheckIn(
          event.id,
          firstName,
          lastName,
          event.requireLogin ? signedInResident?.id : null,
        )
      : null);
  res.json({
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      requireLogin: event.requireLogin,
      locationTracking: event.locationTracking,
      houseMeeting: event.houseMeeting,
      oneResponse: event.oneResponse !== false,
      ...responseGateOf(event),
      submissionsOpen: submissionWindow(responseGateOf(event)).open,
      lat: event.lat,
      lng: event.lng,
      radiusMeters: event.radiusMeters,
      formSchema: JSON.parse(event.formSchema),
      eventType: event.eventType,
    },
    identity: signedInResident
      ? {
          email: signedInResident.email,
          name: `${signedInResident.firstName} ${signedInResident.lastName}`,
          resident: {
            id: signedInResident.id,
            firstName: signedInResident.firstName,
            lastName: signedInResident.lastName,
            room: signedInResident.room,
            hall: signedInResident.hall,
            photoPath: signedInResident.photoPath,
            type: signedInResident.type,
          },
        }
      : identity
        ? { email: identity.email, name: identity.name, resident: null }
        : null,
    alreadySubmitted: Boolean(existing && formWasSubmitted(existing.responseData)),
    alreadyAs: existing
      ? checkedInLabel(browserCheckIn ? "" : firstName, browserCheckIn ? "" : lastName, existing)
      : null,
    markedLate: existing ? attendanceStatus(existing) === "late" : false,
    lateAt: existing ? lateAtOf(existing.responseData) : null,
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

  if (event.requireLogin) {
    if (!identity) {
      res.status(401).json({ error: "Sign in with Stanford to check in" });
      return;
    }
  } else if (!guestName) {
    res.status(400).json({ error: "Enter your first and last name" });
    return;
  }

  const resident = await resolveResident({
    requireLogin: event.requireLogin,
    identity,
    firstName,
    lastName,
  });

  if (event.requireLogin && !resident) {
    res.status(403).json({ error: "Your Stanford email is not on the Branner roster" });
    return;
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
  const answerBag =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? (answers as Record<string, unknown>)
      : {};
  const staffOnly = answerBag.staffMarked === true && !formWasSubmitted(answerBag);

  const responseGate = responseGateOf(event);
  if (!staffOnly && !submissionWindow(responseGate).open) {
    res.status(403).json({ error: submissionClosedMessage(responseGate) });
    return;
  }

  const locationUnavailable = req.body?.locationUnavailable === true;
  if (event.locationTracking && event.lat != null && event.lng != null) {
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      if (!locationUnavailable) {
        res.status(400).json({ error: "Location required" });
        return;
      }
    } else {
      distanceM = haversineMeters(lat, lng, event.lat, event.lng);
      if (!isNearEvent(distanceM, event.radiusMeters, accuracy)) {
        res.status(400).json({
          error: `Too far from the event (${Math.round(distanceM)} m, need ${event.radiusMeters} m)`,
          distanceM,
        });
        return;
      }
    }
  }

  const browserCheckIn =
    event.oneResponse !== false ? await checkInFromBrowser(req, event.id) : null;
  const existing =
    browserCheckIn ??
    (await findExistingCheckIn(
      event.id,
      firstName,
      lastName,
      event.requireLogin ? resident?.id : null,
    ));
  const priorData = parseResponseData(existing?.responseData);
  const priorStatus = existing ? attendanceStatus(existing) : "present";
  const alreadyFilled = existing ? formWasSubmitted(priorData) : false;
  const oneResponse = event.oneResponse !== false;

  if (oneResponse && existing && alreadyFilled && !staffOnly) {
    if (resident && !existing.residentId && !browserCheckIn) {
      await prisma.submission.update({
        where: { id: existing.id },
        data: { residentId: resident.id },
      });
    }
    const who = checkedInLabel(
      browserCheckIn ? "" : firstName,
      browserCheckIn ? "" : lastName,
      existing,
    );
    res.status(409).json({
      error: who
        ? `${who} already checked in for this event`
        : "You already checked in for this event",
      alreadySubmitted: true,
      alreadyAs: who,
      markedLate: priorStatus === "late",
      lateAt: lateAtOf(priorData),
    });
    return;
  }

  const requested =
    answerBag.late === true || String(answerBag.status ?? "").toLowerCase() === "late"
      ? "late"
      : answerBag.excused === true || String(answerBag.status ?? "").toLowerCase() === "excused"
        ? "excused"
        : staffOnly
          ? "present"
          : priorStatus === "late" || priorStatus === "excused"
            ? priorStatus
            : "present";
  const nextData: Record<string, unknown> = {
    ...priorData,
    ...answerBag,
    formSubmitted: staffOnly ? priorData.formSubmitted === true : true,
  };
  if (locationUnavailable && (lat == null || lng == null)) nextData.locationUnavailable = true;
  else delete nextData.locationUnavailable;
  if (requested === "late") {
    nextData.late = true;
    nextData.lateAt =
      (typeof priorData.lateAt === "string" && priorData.lateAt) ||
      (typeof answerBag.lateAt === "string" && answerBag.lateAt) ||
      new Date().toISOString();
    delete nextData.excused;
    delete nextData.excusedAt;
    delete nextData.excusedNote;
  } else if (requested === "excused") {
    nextData.excused = true;
    nextData.excusedAt = new Date().toISOString();
    if (typeof answerBag.excusedNote === "string" && answerBag.excusedNote.trim()) {
      nextData.excusedNote = answerBag.excusedNote.trim();
    }
    delete nextData.late;
    delete nextData.lateAt;
  } else {
    delete nextData.late;
    delete nextData.lateAt;
    delete nextData.excused;
    delete nextData.excusedAt;
    delete nextData.excusedNote;
  }

  const needsSelfie =
    event.locationTracking &&
    event.lat != null &&
    event.lng != null &&
    locationUnavailable &&
    (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) &&
    !staffOnly;
  let selfiePath: string | undefined;
  if (needsSelfie) {
    const saved = saveCheckInSelfie(req.body?.selfie);
    if (saved) selfiePath = saved;
    else if (!existing?.selfiePath) {
      res.status(400).json({ error: "Take a selfie at the meeting" });
      return;
    }
  }

  const payload = {
    responseData: JSON.stringify(nextData),
    lat,
    lng,
    accuracy,
    distanceM,
    status: requested,
    guestName: resident ? existing?.guestName ?? null : guestName || null,
    ...(selfiePath ? { selfiePath } : {}),
  };

  const submission = existing
    ? await prisma.submission.update({
        where: { id: existing.id },
        data: {
          ...payload,
          ...(resident && !existing.residentId ? { residentId: resident.id } : {}),
        },
      })
    : resident
      ? await prisma.submission.create({
          data: {
            eventId: event.id,
            residentId: resident.id,
            ...payload,
          },
        })
      : await prisma.submission.create({
          data: {
            eventId: event.id,
            residentId: null,
            ...payload,
          },
        });

  if (oneResponse && !staffOnly) rememberBrowserCheckIn(res, event.id, submission.id);
  res.json({
    ok: true,
    submissionId: submission.id,
    distanceM,
    late: requested === "late",
    lateAt: lateAtOf(nextData),
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

function saveCheckInSelfie(selfie: unknown): string | null {
  if (typeof selfie !== "string") return null;
  const match = selfie.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const buf = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  if (buf.length < 200 || buf.length > 1_500_000) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const destDir = path.join(uploadsDir(), "checkins");
  mkdirSync(destDir, { recursive: true });
  const name = `${randomBytes(16).toString("hex")}.jpg`;
  writeFileSync(path.join(destDir, name), buf);
  return `/uploads/checkins/${name}`;
}

async function resolveResident({
  requireLogin,
  identity,
  firstName,
  lastName,
}: {
  requireLogin: boolean;
  identity: { email: string } | null;
  firstName: string;
  lastName: string;
}) {
  if (requireLogin) {
    if (!identity) return null;
    return prisma.resident.findUnique({ where: { email: identity.email } });
  }
  if (!firstName && !lastName) return null;
  const roster = await prisma.resident.findMany({
    select: { id: true, firstName: true, lastName: true, legalName: true, email: true },
  });
  const matched = matchResidentByName(firstName, lastName, roster);
  return matched ? prisma.resident.findUnique({ where: { id: matched.id } }) : null;
}

function checkInCookieName(eventId: string) {
  return `branner_checkin_${eventId}`;
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function rememberBrowserCheckIn(res: Response, eventId: string, submissionId: string) {
  const secure = process.env.NODE_ENV === "production";
  res.cookie(checkInCookieName(eventId), submissionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 14 * 24 * 60 * 60 * 1000,
    secure,
    path: "/",
  });
}

async function checkInFromBrowser(req: Request, eventId: string) {
  const id = readCookie(req, checkInCookieName(eventId));
  if (!id) return null;
  const row = await prisma.submission.findFirst({
    where: { id, eventId },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, legalName: true, email: true } },
    },
  });
  if (!row || !formWasSubmitted(row.responseData)) return null;
  return row;
}

function checkedInLabel(
  firstName: string,
  lastName: string,
  existing: {
    guestName: string | null;
    resident: { firstName: string; lastName: string } | null;
  },
) {
  const typed = `${firstName} ${lastName}`.trim();
  const roster = existing.resident
    ? `${existing.resident.firstName} ${existing.resident.lastName}`.trim()
    : "";
  if (typed && roster && normName(typed) !== normName(roster)) return `${typed} (${roster})`;
  return typed || roster || existing.guestName || "";
}

async function findExistingCheckIn(
  eventId: string,
  firstName: string,
  lastName: string,
  loginResidentId?: string | null,
) {
  const typed = normName(`${firstName} ${lastName}`);
  const roster = typed
    ? await prisma.resident.findMany({
        select: { id: true, firstName: true, lastName: true, legalName: true, email: true },
      })
    : [];
  const matched = typed ? matchResidentByName(firstName, lastName, roster) : null;
  const wanted = new Set<string>();
  if (typed) wanted.add(typed);
  if (matched) for (const key of identityNameKeys(matched)) wanted.add(key);

  const rows = await prisma.submission.findMany({
    where: { eventId },
    include: {
      resident: { select: { id: true, firstName: true, lastName: true, legalName: true, email: true } },
    },
  });
  const found =
    rows.find((row) => {
      if (loginResidentId && row.residentId === loginResidentId) return true;
      if (!wanted.size) return false;
      const keys = identityNameKeys({
        firstName: row.resident?.firstName,
        lastName: row.resident?.lastName,
        legalName: row.resident?.legalName,
        email: row.resident?.email,
        guestName: row.guestName,
      });
      return keys.some((key) => wanted.has(key));
    }) ?? null;
  if (found && matched && !found.residentId) {
    await prisma.submission.update({
      where: { id: found.id },
      data: { residentId: matched.id },
    });
    found.residentId = matched.id;
    found.resident = matched;
  }
  return found;
}

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
  const parts = guestName.trim().split(/\s+/).filter(Boolean);
  const prior = await findExistingCheckIn(eventId, parts[0] ?? "", parts.slice(1).join(" "));
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
