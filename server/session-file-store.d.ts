declare module "session-file-store" {
  import session from "express-session";
  export default function factory(
    s: typeof session,
  ): new (opts?: Record<string, unknown>) => session.Store;
}
