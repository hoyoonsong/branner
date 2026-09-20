import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireApproved } from "../auth.js";

export const residentsRouter = Router();

residentsRouter.use(requireApproved);

residentsRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const hall = String(req.query.hall ?? "").trim();
  const residents = await prisma.resident.findMany({
    where: {
      ...(hall ? { hall } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { email: { contains: q } },
              { room: { contains: q } },
              { bedSlot: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ hall: "asc" }, { room: "asc" }, { lastName: "asc" }],
  });
  res.json({ residents });
});

residentsRouter.get("/:id", async (req, res) => {
  const resident = await prisma.resident.findUnique({ where: { id: req.params.id } });
  if (!resident) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const roommates = await prisma.resident.findMany({
    where: { room: resident.room, id: { not: resident.id }, building: "Branner" },
    orderBy: { bedSlot: "asc" },
  });
  res.json({ resident, roommates });
});

residentsRouter.patch("/:id", async (req, res) => {
  const notes = req.body?.notes;
  if (typeof notes !== "string") {
    res.status(400).json({ error: "notes required" });
    return;
  }
  const resident = await prisma.resident.update({
    where: { id: req.params.id },
    data: { notes },
  });
  res.json({ resident });
});
