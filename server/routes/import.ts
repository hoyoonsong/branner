import { Router } from "express";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { uploadsDir } from "../runtime.js";

export const importRouter = Router();

type IncomingResident = {
  firstName: string;
  lastName: string;
  legalName?: string | null;
  email: string;
  building: string;
  bedSlot: string;
  room: string;
  hall: string;
  type: string;
  gender?: string | null;
  minor?: string | null;
  hometown?: string | null;
  country?: string | null;
  phone?: string | null;
  suid?: string | null;
  tshirtSize?: string | null;
  checkIn?: string | null;
  earlyArrival?: string | null;
  notes?: string;
  photoBase64?: string | null;
};

function authorize(req: { get(name: string): string | undefined }, res: { status: (n: number) => { json: (b: unknown) => void } }): boolean {
  const secret = process.env.IMPORT_SECRET;
  if (!secret || req.get("x-import-secret") !== secret) {
    res.status(404).json({ error: "Not found" });
    return false;
  }
  return true;
}

importRouter.post("/roster", async (req, res) => {
  if (!authorize(req, res)) return;
  const residents = req.body?.residents as IncomingResident[] | undefined;
  if (!Array.isArray(residents) || !residents.length) {
    res.status(400).json({ error: "residents required" });
    return;
  }

  const destDir = path.join(uploadsDir(), "residents");
  mkdirSync(destDir, { recursive: true });

  let upserted = 0;
  let photos = 0;
  for (const row of residents) {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email) continue;

    let photoPath: string | null | undefined;
    if (row.photoBase64) {
      const destName = `${email.replace(/[^a-z0-9.@-]/g, "_")}.jpg`;
      writeFileSync(path.join(destDir, destName), Buffer.from(row.photoBase64, "base64"));
      photoPath = `/uploads/residents/${destName}`;
      photos++;
    } else if (row.photoBase64 === "") {
      photoPath = null;
    }

    await prisma.resident.upsert({
      where: { email },
      create: {
        firstName: row.firstName,
        lastName: row.lastName,
        legalName: row.legalName ?? null,
        email,
        building: row.building || "Branner",
        bedSlot: row.bedSlot || "",
        room: row.room || "",
        hall: row.hall || "",
        type: row.type || "Frosh",
        gender: row.gender ?? null,
        minor: row.minor ?? null,
        hometown: row.hometown ?? null,
        country: row.country ?? null,
        phone: row.phone ?? null,
        suid: row.suid ?? null,
        tshirtSize: row.tshirtSize ?? null,
        checkIn: row.checkIn ?? null,
        earlyArrival: row.earlyArrival ?? null,
        notes: row.notes || "",
        photoPath: photoPath ?? null,
      },
      update: {
        firstName: row.firstName,
        lastName: row.lastName,
        legalName: row.legalName ?? null,
        building: row.building,
        bedSlot: row.bedSlot,
        room: row.room,
        hall: row.hall,
        type: row.type,
        gender: row.gender,
        minor: row.minor,
        hometown: row.hometown,
        country: row.country,
        phone: row.phone,
        suid: row.suid,
        tshirtSize: row.tshirtSize,
        checkIn: row.checkIn,
        earlyArrival: row.earlyArrival,
        notes: row.notes,
        ...(photoPath !== undefined ? { photoPath } : {}),
      },
    });
    upserted++;
  }

  res.json({ ok: true, upserted, photos });
});
