import { Router } from "express";
import passport from "passport";
import {
  currentAdmin,
  currentIdentity,
  loginIdentity,
  loginLocal,
  requireApproved,
  safeNext,
  seedAdminEmails,
} from "../auth.js";
import { prisma } from "../prisma.js";
import { googleCallbackUrl } from "../runtime.js";

export const authRouter = Router();

authRouter.get("/me", async (req, res) => {
  const admin = currentAdmin(req);
  const identity = currentIdentity(req);
  let resident = null;
  if (identity) {
    resident = await prisma.resident.findUnique({ where: { email: identity.email } });
  }
  res.json({
    user: admin
      ? { id: admin.id, email: admin.email, name: admin.name, status: admin.status }
      : null,
    identity: identity
      ? {
          email: identity.email,
          name: identity.name,
          resident: resident
            ? {
                id: resident.id,
                firstName: resident.firstName,
                lastName: resident.lastName,
                room: resident.room,
                hall: resident.hall,
              }
            : null,
        }
      : null,
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    allowDevLogin: process.env.ALLOW_DEV_LOGIN === "1" || !process.env.GOOGLE_CLIENT_ID,
  });
});

authRouter.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(400).json({ error: "Google login is not configured" });
    return;
  }
  const nextPath = safeNext(req.query.next);
  passport.authenticate("google", {
    scope: ["email", "profile"],
    hd: "stanford.edu",
    prompt: "select_account",
    state: nextPath || "admin",
    callbackURL: googleCallbackUrl(req),
  })(req, res, next);
});

authRouter.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", {
    failureRedirect: "/login?error=stanford",
    callbackURL: googleCallbackUrl(req),
  })(req, res, next);
}, (req, res) => {
    const next = safeNext(req.query.state);
    if (next) {
      res.redirect(next);
      return;
    }
    const admin = currentAdmin(req);
    if (!admin) {
      res.redirect("/login?error=stanford");
      return;
    }
    if (admin.status !== "approved") {
      res.redirect("/pending");
      return;
    }
    res.redirect("/");
});

authRouter.post("/dev-login", async (req, res) => {
  const allowed = process.env.ALLOW_DEV_LOGIN === "1" || !process.env.GOOGLE_CLIENT_ID;
  if (!allowed) {
    res.status(403).json({ error: "Dev login disabled" });
    return;
  }
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!email.endsWith("@stanford.edu")) {
    res.status(400).json({ error: "Use a @stanford.edu email" });
    return;
  }
  try {
    const admin = await loginLocal(req, email, req.body?.name);
    res.json({
      user: { id: admin.id, email: admin.email, name: admin.name, status: admin.status },
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

authRouter.post("/identify", async (req, res) => {
  const allowed = process.env.ALLOW_DEV_LOGIN === "1" || !process.env.GOOGLE_CLIENT_ID;
  if (!allowed) {
    res.status(403).json({ error: "Use Stanford Google login" });
    return;
  }
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!email.endsWith("@stanford.edu")) {
    res.status(400).json({ error: "Use a @stanford.edu email" });
    return;
  }
  try {
    const result = await loginIdentity(req, email);
    if (!result.resident) {
      res.status(404).json({ error: "That Stanford email is not on the Branner roster" });
      return;
    }
    res.json({
      identity: {
        email: result.email,
        name: result.name,
        resident: {
          id: result.resident.id,
          firstName: result.resident.firstName,
          lastName: result.resident.lastName,
          room: result.resident.room,
          hall: result.resident.hall,
        },
      },
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

authRouter.post("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });
});

authRouter.get("/admins", requireApproved, async (_req, res) => {
  const admins = await prisma.admin.findMany({ orderBy: { createdAt: "asc" } });
  res.json({ admins, seedEmails: seedAdminEmails() });
});

authRouter.patch("/admins/:id", requireApproved, async (req, res) => {
  const status = String(req.body?.status ?? "");
  if (!["approved", "rejected", "pending"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const admin = await prisma.admin.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json({ admin });
});
