import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Activity,
  FilePlus2,
  Files,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";

/**
 * Paper Generator shell — navy sidebar (desktop) + compact top bar (mobile).
 * Features / routes unchanged.
 */
function GeneratorLayout({ title, children, mode = "default", wide = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const academy = user?.academy;
  const isAdmin = user?.role === "academy_admin" || user?.role === "super_admin";
  const isSubAccount = user?.role === "sub_account";
  const homeTo = isAdmin
    ? "/academy"
    : isSubAccount
      ? "/academy/generator"
      : "/teacher";
  const roleLabel = isAdmin
    ? "Administrator"
    : isSubAccount
      ? "Sub account"
      : "Teacher";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMenu = () => setMenuOpen(false);

  if (mode === "paper") {
    return <div className="tg-app tg-app--paper">{children}</div>;
  }

  const sideClass = ({ isActive }) =>
    ["tg-sidebar-link", isActive ? "tg-sidebar-link--active" : ""].join(" ");

  const drawerNavClass = ({ isActive }) =>
    [
      "rounded-xl px-3 py-2.5 transition",
      isActive
        ? "bg-white/15 text-white"
        : "text-white/90 hover:bg-white/10",
    ].join(" ");

  const navItems = [
    { to: homeTo, end: true, label: "Dashboard", icon: LayoutDashboard },
    {
      to: "/academy/generator",
      end: true,
      label: "Generate Paper",
      icon: FilePlus2,
    },
    { to: "/academy/generator/papers", label: "Saved Papers", icon: Files },
    {
      to: "/academy/generator/settings",
      label: "Settings",
      icon: Settings2,
    },
  ];

  if (isAdmin) {
    navItems.push(
      {
        to: "/academy/generator/sub-accounts",
        label: "Sub Accounts",
        icon: UsersRound,
      },
      {
        to: "/academy/generator/activities",
        label: "Activities",
        icon: Activity,
      }
    );
  }

  return (
    <div className="tg-app tg-shell">
      <aside className="tg-sidebar" aria-label="Paper Generator">
        <Link to={homeTo} className="tg-sidebar-brand">
          <div className="tg-sidebar-brand-name">PaperForge</div>
          <div className="tg-sidebar-brand-sub">Test Generator</div>
          {academy?.name ? (
            <p className="mt-2 truncate text-[11px] text-white/55">
              {academy.name}
            </p>
          ) : null}
        </Link>

        <nav className="tg-sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={`${item.to}-${item.label}`}
                to={item.to}
                end={item.end}
                className={sideClass}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon className="size-4 opacity-80" aria-hidden />
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="tg-sidebar-foot">
          <div className="tg-sidebar-user">
            <p className="tg-sidebar-user-name">
              {user?.name || (isAdmin ? "Admin" : "Teacher")}
            </p>
            <p className="tg-sidebar-user-role">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="tg-sidebar-logout"
          >
            <LogOut className="size-3.5" />
            Logout
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="tg-topbar">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <Link to={homeTo} className="min-w-0 flex-1">
            <span className="block truncate font-display text-base font-bold text-white">
              PaperForge
            </span>
            <span className="block truncate text-[11px] text-white/65">
              {academy?.name || "Test Generator"}
            </span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-2 text-xs font-semibold text-[#0f2744]"
            title="Logout"
          >
            <LogOut className="size-3.5" />
            Logout
          </button>
        </header>

        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm min-[900px]:hidden"
              aria-label="Close menu"
              onClick={closeMenu}
            />
            <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-[min(18rem,88vw)] flex-col bg-[#0f2744] p-4 text-white shadow-2xl min-[900px]:hidden">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold">
                    {user?.name || "Admin"}
                  </p>
                  <p className="truncate text-xs text-white/65">
                    {academy?.name || roleLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 text-sm font-semibold">
                {navItems.map((item) => (
                  <NavLink
                    key={`m-${item.to}-${item.label}`}
                    to={item.to}
                    end={item.end}
                    onClick={closeMenu}
                    className={drawerNavClass}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-[#0f2744]"
              >
                <LogOut className="size-4" />
                Logout
              </button>
            </aside>
          </>
        ) : null}

        <main
          className={["tg-main", wide ? "tg-main--wide" : ""].join(" ")}
        >
          <div className="tg-main-inner">
            {title ? (
              <h1 className="mb-5 font-display text-2xl font-bold text-tg-ink sm:text-3xl">
                {title}
              </h1>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default GeneratorLayout;
