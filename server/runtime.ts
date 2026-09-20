import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import path from "path";

export function onRailway(): boolean {
  return Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
}

export function dataDir(): string {
  const preferred = process.env.DATA_DIR || (onRailway() ? "/data" : path.resolve("."));
  try {
    mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = path.resolve("data-runtime");
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

export function publicOrigin(): string {
  const explicit = process.env.PUBLIC_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

export function allowedOrigins(): string[] {
  return [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    publicOrigin(),
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "",
  ].filter(Boolean);
}

export function requestOrigin(req: { get(name: string): string | undefined }): string {
  const hinted = (req.get("x-branner-origin") || "").replace(/\/$/, "");
  if (hinted && allowedOrigins().includes(hinted)) return hinted;
  return publicOrigin();
}

export function googleCallbackUrl(req?: { get(name: string): string | undefined }): string {
  if (req) {
    const origin = requestOrigin(req);
    if (origin) return `${origin}/api/auth/google/callback`;
  }
  if (process.env.GOOGLE_CALLBACK_URL) return process.env.GOOGLE_CALLBACK_URL;
  const origin = publicOrigin();
  return origin ? `${origin}/api/auth/google/callback` : "/api/auth/google/callback";
}

export function sessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const persist = path.join(dataDir(), "session-secret");
  if (existsSync(persist)) return readFileSync(persist, "utf8").trim();
  const secret = randomBytes(32).toString("hex");
  try {
    writeFileSync(persist, secret, { mode: 0o600 });
  } catch {
    /* ephemeral fs is fine for a single instance */
  }
  return secret;
}

export function uploadsDir(): string {
  const dir = process.env.UPLOADS_DIR || path.join(dataDir(), onRailway() ? "uploads" : "uploads");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function sessionsDir(): string {
  const dir = process.env.SESSION_DIR || path.join(dataDir(), "sessions");
  mkdirSync(dir, { recursive: true });
  return dir;
}
