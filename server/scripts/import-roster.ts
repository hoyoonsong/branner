import "dotenv/config";
import { createReadStream, existsSync, mkdirSync, copyFileSync, readdirSync } from "fs";
import { createInterface } from "readline";
import path from "path";
import { prisma } from "../prisma.js";

const ROOT = path.resolve(process.cwd());
const CSV_CANDIDATES = [
  path.join(ROOT, "data", "roster.csv"),
  "/Users/hoyoonsong/.cursor/projects/Users-hoyoonsong-branner/attachments/2a242188-129e-419b-8ece-0e3cf0e1c6c7/Roster_2026-27_-_HousingExportAug16.csv",
];
const PHOTO_DIRS = [
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

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s).split(" ").filter(Boolean);
}

function scoreName(preferred: string, legalFile: string): number {
  const a = tokens(preferred);
  const b = tokens(legalFile.replace(/\.jpe?g$/i, ""));
  if (!a.length || !b.length) return 0;
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  if (lastA !== lastB) {
    // preferred last vs legal last; also try first-of-legal as last
    if (!b.includes(lastA) && !a.includes(lastB)) return 0;
  }
  const setB = new Set(b);
  let hits = 0;
  for (const t of a) if (setB.has(t)) hits++;
  const lastBonus = lastA === lastB ? 3 : b.includes(lastA) ? 1.5 : 0;
  const firstBonus = a[0] && b[0] && (a[0] === b[0] || b.includes(a[0])) ? 2 : 0;
  return hits + lastBonus + firstBonus;
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
  const photoSrc = PHOTO_DIRS.find((p) => existsSync(p));
  const photoFiles = photoSrc
    ? readdirSync(photoSrc).filter((f) => /\.jpe?g$/i.test(f))
    : [];
  const destDir = path.join(ROOT, "uploads", "residents");
  mkdirSync(destDir, { recursive: true });

  const rows = await readCsv(csvPath);
  const header = rows[0];
  console.log("CSV columns", header.length, "rows", rows.length - 1);

  let matched = 0;
  let missingPhoto = 0;

  for (const row of rows.slice(1)) {
    const last = row[0]?.trim();
    const first = row[1]?.trim();
    const email = row[2]?.trim().toLowerCase();
    if (!email || !first || !last) continue;
    const building = row[3]?.trim() || "Branner";
    const bedSlot = row[4]?.trim() || "";
    const room = row[13]?.trim() || bedSlot.replace(/[A-C]$/, "");
    const hall = row[14]?.trim() || "";
    const type = row[10]?.trim() || "Frosh";
    const preferred = `${first} ${last}`;

    let photoPath: string | null = null;
    let legalName: string | null = null;
    if (photoFiles.length) {
      let best = { file: "", score: 0 };
      for (const file of photoFiles) {
        const s = scoreName(preferred, file);
        if (s > best.score) best = { file, score: s };
      }
      if (best.score >= 4) {
        const destName = `${email.replace(/[^a-z0-9.@-]/g, "_")}.jpg`;
        copyFileSync(path.join(photoSrc!, best.file), path.join(destDir, destName));
        photoPath = `/uploads/residents/${destName}`;
        legalName = best.file.replace(/\.jpe?g$/i, "");
        matched++;
      } else {
        missingPhoto++;
        console.log("No photo for", preferred, "best", best.file, best.score);
      }
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
        photoPath: photoPath ?? undefined,
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
