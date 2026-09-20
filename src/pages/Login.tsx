import { FormEvent, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { user, googleEnabled, allowDevLogin, devLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [search] = useSearchParams();
  const nav = useNavigate();
  const oauthError = search.get("error");

  if (user?.status === "approved") return <Navigate to="/attendance" replace />;
  if (user) return <Navigate to="/pending" replace />;

  const onDev = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const u = await devLogin(email);
      nav(u.status === "approved" ? "/attendance" : "/pending");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cardinal">Branner Hall</p>
        <h1 className="mt-2 font-display text-3xl">Staff sign in</h1>
        <p className="mt-2 text-sm text-stone-mute">
          Use your Stanford Google account (@stanford.edu). Existing staff approve new people.
        </p>
        {oauthError === "stanford" && (
          <p className="mt-4 rounded-lg bg-cardinal/10 px-3 py-2 text-sm text-cardinal">
            That Google account is not a Stanford email. Sign in with your SUNet @stanford.edu
            account.
          </p>
        )}
        {googleEnabled ? (
          <a
            href="/api/auth/google"
            className="mt-6 block rounded-lg bg-cardinal px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Continue with Stanford Google
          </a>
        ) : (
          <p className="mt-6 text-sm text-stone-mute">
            Stanford Google login is not configured on this server yet.
          </p>
        )}
        {allowDevLogin && (
          <form onSubmit={onDev} className="mt-6 space-y-3">
            <p className="text-xs text-stone-mute">
              Dev login — use a @stanford.edu email to request access.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sunet@stanford.edu"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-cardinal">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-lg border border-black/10 py-2 text-sm font-medium"
            >
              Continue
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
