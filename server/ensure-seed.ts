import { seedAdminEmails } from "./auth.js";
import { prisma } from "./prisma.js";

export async function ensureSeed() {
  await prisma.eventType.upsert({
    where: { slug: "house-meeting" },
    create: { label: "House meeting", slug: "house-meeting" },
    update: { label: "House meeting" },
  });
  await prisma.eventType.upsert({
    where: { slug: "dorm-trip" },
    create: { label: "Dorm trip", slug: "dorm-trip" },
    update: { label: "Dorm trip" },
  });

  for (const email of seedAdminEmails()) {
    await prisma.admin.upsert({
      where: { email },
      create: {
        email,
        name: email.split("@")[0],
        status: "approved",
      },
      update: { status: "approved" },
    });
  }
}
