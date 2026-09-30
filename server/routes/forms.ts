import { Router } from "express";
import { requireApproved } from "../auth.js";
import { connectedForm } from "../connected-forms.js";
import { loadFormResponses, SheetsNotConnected } from "../sheets.js";

export const formsRouter = Router();

formsRouter.use(requireApproved);

formsRouter.get("/:id", async (req, res) => {
  const form = connectedForm(req.params.id);
  if (!form) {
    res.status(404).json({ error: "Unknown form" });
    return;
  }
  const fresh = req.query.fresh === "1";
  try {
    const responses = await loadFormResponses(form, fresh);
    res.json({
      id: form.id,
      title: form.title,
      description: form.description,
      matchOn: form.matchOn,
      responses,
      fetchedAt: new Date().toISOString(),
      needsConnection: false,
      error: null,
    });
  } catch (err) {
    const needsConnection = err instanceof SheetsNotConnected;
    res.json({
      id: form.id,
      title: form.title,
      description: form.description,
      matchOn: form.matchOn,
      responses: [],
      fetchedAt: null,
      needsConnection,
      error: needsConnection ? null : err instanceof Error ? err.message : "Could not load responses",
    });
  }
});
