import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessPage, firstStaffPath, isFullAdmin, STAFF_PAGES } from "../lib/permissions";
import { clsx } from "../lib/utils";

export function Layout() {
  const { user, logout } = useAuth();
  const links = [
    ...STAFF_PAGES.filter((page) => canAccessPage(user, page.id)).map((page) => ({
      to: page.to,
      label: page.label,
    })),
    ...(isFullAdmin(user) ? [{ to: "/admins", label: "Admins" }] : []),
  ];
  const home = firstStaffPath(user) ?? "/";
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-cardinal text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <NavLink to={home} className="shrink-0 font-display text-xl tracking-tight">
            Branner
          </NavLink>
          <nav className="hidden min-w-0 flex-1 items-center gap-1 text-sm lg:flex">
            {links.map((link) => (
              <NavItem key={link.to} to={link.to} label={link.label} />
            ))}
          </nav>
          <div className="ml-auto hidden max-w-[14rem] truncate text-sm text-white/80 xl:block">{user?.email}</div>
          <button
            type="button"
            onClick={() => logout()}
            className="hidden shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 lg:inline"
          >
            Sign out
          </button>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
            className="ml-auto rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium lg:hidden"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" className="space-y-1 border-t border-white/10 px-3 py-3 lg:hidden">
            {links.map((link) => (
              <NavItem key={link.to} to={link.to} label={link.label} block />
            ))}
            {user?.email && <p className="break-all px-3 pt-2 text-xs text-white/70">{user.email}</p>}
            <button
              type="button"
              onClick={() => logout()}
              className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white/10"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, label, block = false }: { to: string; label: string; block?: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          "rounded-md px-3 py-2 text-sm font-medium lg:py-1.5",
          block && "block",
          isActive ? "bg-white/15" : "text-white/80 hover:bg-white/10",
        )
      }
    >
      {label}
    </NavLink>
  );
}
