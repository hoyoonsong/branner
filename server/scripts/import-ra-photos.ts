import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { scoreName } from "../names.js";

const ROOT = path.resolve(process.cwd());
const PHOTO_DIR = path.join(ROOT, "data", "ra-photos");

async function main() {
  if (!existsSync(PHOTO_DIR)) {
    throw new Error(`RA photos not found at ${PHOTO_DIR}`);
  }
  const files = readdirSync(PHOTO_DIR).filter((f) => /\.jpe?g$/i.test(f));
  const destDir = path.join(ROOT, "uploads", "residents");
  mkdirSync(destDir, { recursive: true });

  const residents = await prisma.resident.findMany();
  let matched = 0;
  for (const file of files) {
    const label = file.replace(/\.jpe?g$/i, "");
    let best = { row: residents[0], score: 0 };
    for (const row of residents) {
      const preferred = scoreName(label, `${row.firstName} ${row.lastName}`);
      const legal = row.legalName ? scoreName(label, row.legalName) : 0;
      const typed = row.type === "RA" ? 0.5 : 0;
      const score = Math.max(preferred, legal) + typed;
      if (score > best.score) best = { row, score };
    }
    if (!best.row || best.score < 4) {
      console.log("No resident for", label, "best", best.row?.firstName, best.row?.lastName, best.score);
      continue;
    }
    const destName = `${best.row.email.replace(/[^a-z0-9.@-]/g, "_")}.jpg`;
    copyFileSync(path.join(PHOTO_DIR, file), path.join(destDir, destName));
    await prisma.resident.update({
      where: { id: best.row.id },
      data: {
        type: "RA",
        legalName: best.row.legalName || label,
        photoPath: `/uploads/residents/${destName}`,
      },
    });
    matched++;
    console.log("RA photo", label, "→", `${best.row.firstName} ${best.row.lastName}`);
  }
  console.log(`Matched ${matched} / ${files.length} RA photos`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
