import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import FileStoreFactory from "session-file-store";
import { prisma } from "./prisma.js";
import {
  googleCallbackUrl,
  onRailway,
  sessionSecret,
  sessionsDir,
} from "./runtime.js";

const FileStore = FileStoreFactory(session);

export type AuthedAdmin = {
  id: string;
  email: string;
  name: string;
  status: string;
};

export type SessionUser = {
  email: string;
  name: string;
  admin?: AuthedAdmin | null;
};

export function seedAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isStanford(email: string): boolean {
  return email.toLowerCase().endsWith("@stanford.edu");
}

export function safeNext(raw: unknown): string {
  const value = decodeURIComponent(String(raw ?? "")).trim();
  if (value.startsWith("/a/") && !value.includes("//") && !value.includes("\\")) {
    return value;
  }
  return "";
}

async function upsertAdmin(input: {
  email: string;
  name: string;
  googleId?: string;
}): Promise<AuthedAdmin> {
  const email = input.email.toLowerCase();
  const seeded = seedAdminEmails();
  const existing = await prisma.admin.findUnique({ where: { email } });
  const status =
    existing?.status === "approved" || existing?.status === "rejected"
      ? existing.status
      : seeded.includes(email)
        ? "approved"
        : "pending";

  const admin = await prisma.admin.upsert({
    where: { email },
    create: {
      email,
      name: input.name,
      googleId: input.googleId,
      status,
    },
    update: {
      name: input.name || existing?.name || email,
      googleId: input.googleId ?? existing?.googleId,
      status,
    },
  });
  return admin;
}

export function configureAuth(app: Express) {
  const production = onRailway() || process.env.NODE_ENV === "production";
  app.use(
    session({
      store: new FileStore({ path: sessionsDir(), ttl: 60 * 60 * 24 * 14, logFn: () => {} }),
      secret: sessionSecret(),
      resave: false,
      saveUninitialized: false,
      proxy: production,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 14 * 24 * 60 * 60 * 1000,
        secure: production,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, done) => {
    const u = user as SessionUser & AuthedAdmin;
    done(null, { email: u.email, name: u.name });
  });
  passport.deserializeUser(async (stored: { email?: string; name?: string } | string, done) => {
    try {
      if (typeof stored === "string") {
        const admin =
          (await prisma.admin.findUnique({ where: { id: stored } })) ??
          (await prisma.admin.findUnique({ where: { email: stored } }));
        if (!admin) {
          done(null, false);
          return;
        }
        done(null, { email: admin.email, name: admin.name, admin });
        return;
      }
      const email = stored?.email?.toLowerCase();
      if (!email) {
        done(null, false);
        return;
      }
      const admin = await prisma.admin.findUnique({ where: { email } });
      done(null, {
        email,
        name: stored.name ?? admin?.name ?? email,
        admin,
      });
    } catch (err) {
      done(err);
    }
  });

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (clientID && clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: googleCallbackUrl(),
          passReqToCallback: true,
        },
        async (req, _access, _refresh, profile, done) => {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const hostedDomain = (profile._json as { hd?: string } | undefined)?.hd?.toLowerCase();
          if (!email || !isStanford(email) || (hostedDomain && hostedDomain !== "stanford.edu")) {
            return done(null, false);
          }
          const name = profile.displayName || email;
          const next = safeNext(req.query.state);
          try {
            if (next.startsWith("/a/")) {
              const admin = await prisma.admin.findUnique({ where: { email } });
              done(null, { email, name, admin });
              return;
            }
            const admin = await upsertAdmin({ email, name, googleId: profile.id });
            done(null, { email, name, admin });
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }
}

export function currentAdmin(req: Request): AuthedAdmin | null {
  const user = req.user as (SessionUser & AuthedAdmin) | undefined;
  if (!user) return null;
  if (user.admin) return user.admin;
  if (user.id && user.status) {
    return { id: user.id, email: user.email, name: user.name, status: user.status };
  }
  return null;
}

export function currentIdentity(req: Request): { email: string; name: string } | null {
  const user = req.user as SessionUser | undefined;
  if (user?.email) return { email: user.email, name: user.name || user.email };
  const admin = currentAdmin(req);
  if (admin) return { email: admin.email, name: admin.name };
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const admin = currentAdmin(req);
  if (!admin) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  next();
}

export function requireApproved(req: Request, res: Response, next: NextFunction) {
  const admin = currentAdmin(req);
  if (!admin) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  if (admin.status !== "approved") {
    res.status(403).json({ error: "Awaiting admin approval", status: admin.status });
    return;
  }
  next();
}

export async function loginLocal(req: Request, email: string, name?: string) {
  if (!isStanford(email)) {
    throw new Error("Stanford email required");
  }
  const admin = await upsertAdmin({ email, name: name || email.split("@")[0] });
  await new Promise<void>((resolve, reject) => {
    req.login({ email: admin.email, name: admin.name, admin }, (err) =>
      err ? reject(err) : resolve(),
    );
  });
  return admin;
}

export async function loginIdentity(req: Request, email: string) {
  if (!isStanford(email)) {
    throw new Error("Stanford email required");
  }
  const normalized = email.toLowerCase();
  const resident = await prisma.resident.findUnique({ where: { email: normalized } });
  const admin = await prisma.admin.findUnique({ where: { email: normalized } });
  const name = resident ? `${resident.firstName} ${resident.lastName}` : admin?.name || normalized;
  await new Promise<void>((resolve, reject) => {
    req.login({ email: normalized, name, admin }, (err) => (err ? reject(err) : resolve()));
  });
  return { email: normalized, name, resident, admin };
}
