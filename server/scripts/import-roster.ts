import "dotenv/config";
import { createReadStream, existsSync, mkdirSync, copyFileSync, readdirSync } from "fs";
import { createInterface } from "readline";
import path from "path";
import { prisma } from "../prisma.js";
import { assignPhotos } from "../names.js";

const ROOT = path.resolve(process.cwd());
const CSV_CANDIDATES = [
  path.join(ROOT, "data", "roster.csv"),
  "/Users/hoyoonsong/.cursor/projects/Users-hoyoonsong-branner/attachments/2a242188-129e-419b-8ece-0e3cf0e1c6c7/Roster_2026-27_-_HousingExportAug16.csv",
];
const PHOTO_DIRS = [
  path.join(ROOT, "data", "ra-photos"),
  path.join(ROOT, "data", "photos-src"),
  path.join(ROOT, "data", "Frosh ID Photos (160 as of Aug 20)"),
];

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function readCsv(file: string): Promise<string[][]> {
  const rows: string[][] = [];
  const rl = createInterface({ input: createReadStream(file) });
  for await (const line of rl) {
    if (!line.trim()) continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
}

async function main() {
  const csvPath = CSV_CANDIDATES.find((p) => existsSync(p));
  if (!csvPath) {
    throw new Error("Roster CSV not found. Put it at data/roster.csv");
  }
  const photoFiles = PHOTO_DIRS.filter((p) => existsSync(p)).flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => /\.jpe?g$/i.test(f))
      .map((file) => ({ file, dir })),
  );
  const destDir = path.join(ROOT, "uploads", "residents");
  mkdirSync(destDir, { recursive: true });

  const rows = await readCsv(csvPath);
  const header = rows[0];
  console.log("CSV columns", header.length, "rows", rows.length - 1);

  const people = rows.slice(1).flatMap((row) => {
    const last = row[0]?.trim();
    const first = row[1]?.trim();
    const email = row[2]?.trim().toLowerCase();
    if (!email || !first || !last) return [];
    return [{ firstName: first, lastName: last, email, row }];
  });
  const photoByEmail = new Map<string, { file: string; dir: string; label: string }>();
  if (photoFiles.length) {
    const assigned = assignPhotos(
      photoFiles.map((photo) => ({
        id: `${photo.dir}::${photo.file}`,
        label: photo.file,
      })),
      people,
    );
    for (const [id, person] of assigned) {
      const [dir, file] = id.split("::");
      photoByEmail.set(person.email, { dir, file, label: file.replace(/\.jpe?g$/i, "") });
    }
  }

  let matched = 0;
  let missingPhoto = 0;

  for (const person of people) {
    const { first, last, email, row } = {
      first: person.firstName,
      last: person.lastName,
      email: person.email,
      row: person.row,
    };
    const building = row[3]?.trim() || "Branner";
    const bedSlot = row[4]?.trim() || "";
    const room = row[13]?.trim() || bedSlot.replace(/[A-C]$/, "");
    const hall = row[14]?.trim() || "";
    const type = row[10]?.trim() || "Frosh";
    const preferred = `${first} ${last}`;

    let photoPath: string | null = null;
    let legalName: string | null = null;
    const photo = photoByEmail.get(email);
    if (photo) {
      const destName = `${email.replace(/[^a-z0-9.@-]/g, "_")}.jpg`;
      copyFileSync(path.join(photo.dir, photo.file), path.join(destDir, destName));
      photoPath = `/uploads/residents/${destName}`;
      legalName = photo.label;
      matched++;
      console.log("Photo", preferred, "←", photo.file);
    } else {
      missingPhoto++;
      console.log("No photo for", preferred);
    }

    const clean = (v: string | undefined) => {
      const s = (v ?? "").trim();
      if (!s || s === "#N/A") return null;
      return s;
    };

    await prisma.resident.upsert({
      where: { email },
      create: {
        firstName: first,
        lastName: last,
        legalName,
        email,
        building,
        bedSlot,
        room,
        hall,
        type,
        gender: clean(row[8]),
        minor: clean(row[9]),
        hometown: clean(row[16]),
        country: clean(row[17]),
        phone: clean(row[19]),
        suid: clean(row[15]),
        tshirtSize: clean(row[18]),
        checkIn: clean(row[6]),
        earlyArrival: clean(row[7]),
        photoPath,
      },
      update: {
        firstName: first,
        lastName: last,
        legalName,
        building,
        bedSlot,
        room,
        hall,
        type,
        gender: clean(row[8]),
        minor: clean(row[9]),
        hometown: clean(row[16]),
        country: clean(row[17]),
        phone: clean(row[19]),
        suid: clean(row[15]),
        tshirtSize: clean(row[18]),
        checkIn: clean(row[6]),
        earlyArrival: clean(row[7]),
        photoPath,
      },
    });
  }

  console.log("Imported residents. Photos matched:", matched, "missing:", missingPhoto);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
