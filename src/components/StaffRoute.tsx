import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessPage, firstStaffPath, isFullAdmin, type StaffPageId } from "../lib/permissions";

export function StaffRoute({ page }: { page: StaffPageId }) {
  const { user } = useAuth();
  if (canAccessPage(user, page)) return <Outlet />;
  const next = firstStaffPath(user);
  if (!next) return <NoAccess />;
  return <Navigate to={next} replace />;
}

export function AdminsRoute() {
  const { user } = useAuth();
  if (isFullAdmin(user)) return <Outlet />;
  const next = firstStaffPath(user);
  if (!next) return <NoAccess />;
  return <Navigate to={next} replace />;
}

export function HomeRedirect() {
  const { user } = useAuth();
  const next = firstStaffPath(user);
  if (!next) return <NoAccess />;
  return <Navigate to={next} replace />;
}

export function NoAccess() {
  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl">No pages yet</h1>
      <p className="mt-2 max-w-md text-sm text-stone-mute">
        An admin has not given you access to any pages. Ask them to turn some on.
      </p>
    </div>
  );
}
