import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { existsSync } from "fs";
import { configureAuth } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { residentsRouter } from "./routes/residents.js";
import { eventsRouter } from "./routes/events.js";
import { publicRouter } from "./routes/public.js";
import { geoRouter } from "./routes/geo.js";
import { ensureSeed } from "./ensure-seed.js";
import { googleCallbackUrl, publicOrigin, uploadsDir } from "./runtime.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.set("trust proxy", 1);
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

configureAuth(app);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    publicOrigin: publicOrigin() || null,
    googleCallback: googleCallbackUrl(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/residents", residentsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/public", publicRouter);
app.use("/api/geo", geoRouter);

const uploads = uploadsDir();
app.use("/uploads", express.static(uploads));

const dist = path.resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }
    res.sendFile(path.join(dist, "index.html"));
  });
}

async function main() {
  await ensureSeed();
  app.listen(PORT, () => {
    const origin = publicOrigin() || `http://localhost:${PORT}`;
    console.log(`Branner API on :${PORT}`);
    console.log(`Public origin: ${origin}`);
    console.log(
      `Google OAuth: ${process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "enabled" : "not configured"}`,
    );
    console.log(`Google callback: ${googleCallbackUrl()}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
