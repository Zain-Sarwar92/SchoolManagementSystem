import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Building2, LayoutDashboard, LogOut, Menu, School, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

function DashboardLayout({ title, navItems, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-soft via-blush to-rose/40 text-navy">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-3 sm:gap-6 sm:p-4 md:flex-row md:p-6">
        <div className="flex items-center justify-between rounded-2xl border border-rose/40 bg-navy px-3 py-2.5 text-blush md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-lavender/30">
              <School className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-white">CampusCloud</p>
              <p className="truncate text-[11px] text-rose/90">{title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lavender"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
        </div>

        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm md:hidden"
            aria-label="Close menu overlay"
            onClick={closeMobile}
          />
        )}

        <aside
          className={[
            "z-50 flex w-[min(18rem,88vw)] shrink-0 flex-col rounded-3xl border border-rose/40 bg-navy p-5 text-blush shadow-[0_18px_40px_rgb(31_34_50_/0.18)] transition duration-200 md:static md:flex md:w-64 md:translate-x-0 md:opacity-100",
            mobileOpen
              ? "fixed bottom-3 left-3 top-3 translate-x-0 opacity-100"
              : "pointer-events-none fixed bottom-3 left-3 top-3 -translate-x-[110%] opacity-0 md:pointer-events-auto",
          ].join(" ")}
        >
          <div className="mb-6 flex items-center justify-between gap-3 md:mb-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-lavender/30 text-blush">
                <School className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold leading-tight text-white">CampusCloud</p>
                <p className="text-xs text-rose/90">School SaaS</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeMobile}
              className="inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-xl bg-white/10 md:hidden"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
          </div>

          <nav className="space-y-1" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeMobile}
                className={({ isActive }) =>
                  [
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender",
                    isActive
                      ? "bg-lavender text-navy"
                      : "text-blush/85 hover:bg-white/10 hover:text-white",
                  ].join(" ")
                }
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-5">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-rose/80">{user?.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm text-blush transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-4 rounded-2xl border border-rose/40 bg-white/80 px-4 py-3 shadow-[0_12px_30px_rgb(31_34_50_/0.08)] backdrop-blur sm:mb-6 sm:rounded-3xl sm:px-5 sm:py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-xl font-semibold text-navy sm:text-2xl md:text-3xl">{title}</h1>
                <p className="text-sm text-slate">
                  {user?.role === "super_admin" ? "Platform control" : "Academy workspace"}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blush px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-navy">
                {user?.role === "super_admin" ? (
                  <LayoutDashboard className="size-3.5" aria-hidden="true" />
                ) : (
                  <Building2 className="size-3.5" aria-hidden="true" />
                )}
                <span className="max-w-[10rem] truncate">{user?.role?.replace("_", " ")}</span>
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
