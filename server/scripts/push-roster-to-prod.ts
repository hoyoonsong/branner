import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const SOURCE_DB = path.resolve("prisma/dev.db");
const DEST = (process.env.PROD_URL || "https://branner.hoyoonsong.com").replace(/\/$/, "");
const SECRET = process.env.IMPORT_SECRET;
const BATCH = 12;

if (!SECRET) {
  throw new Error("Set IMPORT_SECRET in .env to match Railway");
}
if (!existsSync(SOURCE_DB)) {
  throw new Error(`Local roster DB not found at ${SOURCE_DB}`);
}

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${SOURCE_DB}` } },
});

async function main() {
  const residents = await prisma.resident.findMany({ orderBy: { email: "asc" } });
  console.log(`Pushing ${residents.length} residents to ${DEST}`);

  for (let i = 0; i < residents.length; i += BATCH) {
    const slice = residents.slice(i, i + BATCH).map((row) => {
      let photoBase64: string | null = null;
      if (row.photoPath) {
        const file = path.join(process.cwd(), row.photoPath.replace(/^\//, ""));
        if (existsSync(file)) photoBase64 = readFileSync(file).toString("base64");
      }
      return {
        firstName: row.firstName,
        lastName: row.lastName,
        legalName: row.legalName,
        email: row.email,
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
        photoBase64,
      };
    });

    const res = await fetch(`${DEST}/api/import/roster`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-import-secret": SECRET,
      },
      body: JSON.stringify({ residents: slice }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Import failed at ${i}: ${res.status} ${text}`);
    }
    console.log(`Batch ${i + 1}-${i + slice.length}: ${text}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
