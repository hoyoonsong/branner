import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Pending() {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === "approved") return <Navigate to="/attendance" replace />;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="font-display text-2xl">Waiting for approval</h1>
        <p className="mt-3 text-sm text-stone-mute">
          {user.email} is signed in, but another Branner admin still needs to approve your
          access.
        </p>
        <button type="button" onClick={() => logout()} className="mt-6 text-sm text-cardinal">
          Sign out
        </button>
      </div>
    </div>
  );
}
