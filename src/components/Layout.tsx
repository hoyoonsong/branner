import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { clsx } from "../lib/utils";

const links = [
  { to: "/attendance", label: "Attendance" },
  { to: "/residents", label: "Residents" },
  { to: "/map", label: "Map" },
  { to: "/admins", label: "Admins" },
];

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-cardinal text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <NavLink to="/attendance" className="font-display text-xl tracking-tight">
            Branner
          </NavLink>
          <nav className="flex flex-1 gap-1 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  clsx(
                    "rounded-md px-3 py-1.5 font-medium",
                    isActive ? "bg-white/15" : "text-white/80 hover:bg-white/10",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden text-sm text-white/80 sm:block">{user?.email}</div>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
