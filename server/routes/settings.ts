import { Router } from "express";
import { currentAdmin, requireFullAdmin } from "../auth.js";
import {
  reminderOverview,
  replaceReminderRecipients,
  sendTestReminder,
} from "../birthday-reminders.js";

export const settingsRouter = Router();

settingsRouter.use(requireFullAdmin);

settingsRouter.get("/birthday-reminders", async (_req, res) => {
  res.json(await reminderOverview());
});

settingsRouter.put("/birthday-reminders", async (req, res) => {
  const emails = req.body?.emails;
  if (!Array.isArray(emails) || emails.some((email) => typeof email !== "string")) {
    res.status(400).json({ error: "emails must be a list" });
    return;
  }
  try {
    await replaceReminderRecipients(emails);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not save" });
    return;
  }
  res.json(await reminderOverview());
});

settingsRouter.post("/birthday-reminders/test", async (req, res) => {
  const admin = currentAdmin(req);
  if (!admin?.email) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  try {
    await sendTestReminder(admin.email);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Could not send" });
    return;
  }
  res.json({ ok: true, email: admin.email });
});
