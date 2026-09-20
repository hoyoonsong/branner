import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Protected() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return <div className="p-12 text-center text-stone-mute">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (user.status !== "approved") {
    return <Navigate to="/pending" replace />;
  }
  return <Outlet />;
}
