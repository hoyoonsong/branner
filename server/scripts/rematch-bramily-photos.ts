import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { lastNameOf, matchResidentByName, nameTokens, scoreName } from "../names.js";

const ROOT = path.resolve(process.cwd());
const PAIRS = path.join(ROOT, "data", "bramily-pairs.json");
const DEST_DIR = path.join(ROOT, "uploads", "residents");
const NAMED_DIRS = [
  path.join(ROOT, "data", "ra-photos"),
  path.join(ROOT, "data", "Frosh ID Photos (160 as of Aug 20)"),
];

type Pair = { index: number; name: string; file: string; page: number; hasPhoto: boolean };

const OCR_FIX: Record<string, string> = {
  "babina bakshi": "Babiha Bakshi",
  "essi ca schmilovich": "Jessica Schmilovich",
  "essica schmilovich": "Jessica Schmilovich",
  "alli katila milkkulainen": "Alli Katila-Miikkulainen",
  "george mirgoroaskiy": "George Mirgorodskiy",
  "logan isopanoglou": "Logan Tsopanoglou",
};

function tidyName(raw: string): string {
  const key = nameTokens(raw).join(" ");
  return OCR_FIX[key] ?? raw.replace(/^essica\b/i, "Jessica");
}

function namedFiles(): { label: string; file: string }[] {
  return NAMED_DIRS.filter((dir) => existsSync(dir)).flatMap((dir) =>
    readdirSync(dir)
      .filter((file) => /\.jpe?g$/i.test(file))
      .map((file) => ({ label: file.replace(/\.jpe?g$/i, ""), file: path.join(dir, file) })),
  );
}

function pickNamedFile(name: string, files: { label: string; file: string }[]) {
  const scored = files
    .map((file) => ({ file, score: scoreName(name, file.label) }))
    .filter((row) => row.score >= 5)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 1) return scored[0].file;
  if (scored.length > 1 && scored[0].score > scored[1].score + 1.5) return scored[0].file;
  return null;
}

async function main() {
  const pairs = JSON.parse(readFileSync(PAIRS, "utf8")) as Pair[];
  const residents = await prisma.resident.findMany();
  const files = namedFiles();
  mkdirSync(DEST_DIR, { recursive: true });

  let matched = 0;
  let named = 0;
  const unmatched: string[] = [];

  for (const pair of pairs) {
    const name = tidyName(pair.name);
    const tokens = nameTokens(name);
    const first = tokens[0] ?? "";
    const last = tokens.slice(1).join(" ");
    let resident = matchResidentByName(first, last, residents);
    if (!resident) {
      const lastHits = residents.filter((row) => {
        const wanted = lastNameOf(last || name);
        return lastNameOf(row.lastName) === wanted || lastNameOf(row.legalName ?? "") === wanted;
      });
      if (lastHits.length === 1) resident = lastHits[0];
    }
    if (!resident) {
      unmatched.push(name);
      continue;
    }

    const destName = `${resident.email.replace(/[^a-z0-9.@-]/g, "_")}.jpg`;
    const dest = path.join(DEST_DIR, destName);
    const better = pickNamedFile(name, files) ?? pickNamedFile(`${resident.firstName} ${resident.lastName}`, files);
    const source = better?.file && existsSync(better.file) ? better.file : pair.file;
    if (better?.file && source === better.file) named++;
    if (!existsSync(source)) {
      unmatched.push(`${name} (missing file)`);
      continue;
    }
    copyFileSync(source, dest);
    await prisma.resident.update({
      where: { id: resident.id },
      data: { photoPath: `/uploads/residents/${destName}` },
    });
    matched++;
    console.log(`${matched.toString().padStart(3)} ${resident.firstName} ${resident.lastName} ← ${path.basename(source)}`);
  }

  console.log(`Matched ${matched}/${pairs.length}. Named ID files used: ${named}. Unmatched: ${unmatched.length}`);
  if (unmatched.length) console.log(unmatched.join("\n"));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
