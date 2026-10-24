import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  FilePlus2,
  FolderOpen,
  Layers2,
  Settings2,
  UsersRound,
} from "lucide-react";
import GeneratorLayout from "../components/GeneratorLayout.jsx";
import StatusPanel from "../components/StatusPanel.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import api from "../../../services/api.js";

/**
 * Module tiles — same 6 routes; visual language matches syllabus cards.
 * Method 2 stays a disabled placeholder.
 */
const TILES = [
  {
    to: "/academy/generator",
    title: "Generate Paper",
    subtitle: "Method 1",
    icon: FilePlus2,
  },
  {
    to: null,
    title: "Generate Paper",
    subtitle: "Method 2",
    icon: Layers2,
    badge: "Coming soon",
    disabled: true,
  },
  {
    to: "/academy/generator/papers",
    title: "Saved Papers",
    subtitle: "Download / Print",
    icon: FolderOpen,
    countKey: "papers",
  },
  {
    to: "/academy/generator/sub-accounts",
    title: "Sub Accounts",
    subtitle: "Create subuser logins",
    icon: UsersRound,
    countKey: "users",
  },
  {
    to: "/academy/generator/activities",
    title: "Account Activities",
    subtitle: "Audit log",
    icon: ClipboardList,
  },
  {
    to: "/academy/generator/settings",
    title: "Account Settings",
    subtitle: "Fonts, sizes & print",
    icon: Settings2,
  },
];

function GeneratorDashboard() {
  const { user } = useAuth();
  const [paperCount, setPaperCount] = useState(null);
  const [userCount, setUserCount] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    setStatsError(null);
    Promise.all([
      api.get("/generator/papers").then((res) => {
        setPaperCount(res.data.count ?? res.data.papers?.length ?? 0);
      }),
      api.get("/generator/sub-accounts?includeInactive=1").then((res) => {
        setUserCount(res.data.subAccounts?.length ?? 0);
      }),
    ])
      .catch(() => {
        setPaperCount(0);
        setUserCount(0);
        setStatsError("Could not refresh dashboard counts.");
      })
      .finally(() => {
        setStatsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const counts = {
    papers: paperCount,
    users: userCount,
  };

  return (
    <GeneratorLayout>
      <div className="tg-dash-head">
        <p className="tg-dash-eyebrow">Welcome</p>
        <h1 className="tg-dash-title">{user?.name || "Administrator"}</h1>
        <p className="tg-dash-sub">
          {user?.academy?.name || "Test Generator"} · Paper Generator dashboard
        </p>
      </div>

      {statsError ? (
        <div className="mb-4">
          <StatusPanel error={statsError} onRetry={loadStats} />
        </div>
      ) : null}

      <section className="tg-dash-grid" aria-label="Modules">
        {TILES.map((tile, index) => {
          const Icon = tile.icon;
          const count =
            tile.countKey != null ? counts[tile.countKey] : undefined;
          const showCountSkeleton =
            tile.countKey != null && statsLoading && count == null;

          const body = (
            <>
              {tile.badge ? (
                <span className="tg-dash-badge">{tile.badge}</span>
              ) : null}
              {showCountSkeleton ? (
                <span
                  className="tg-dash-tile-count tg-dash-tile-count--skel"
                  aria-hidden
                />
              ) : count != null ? (
                <span className="tg-dash-tile-count">{count}</span>
              ) : null}
              <span className="tg-dash-tile-icon" aria-hidden>
                <Icon strokeWidth={1.75} className="size-7" />
              </span>
              <span className="tg-dash-tile-copy">
                <h3>{tile.title}</h3>
                <p>{tile.subtitle}</p>
              </span>
            </>
          );

          const className = [
            "tg-dash-tile",
            "tg-anim-in",
            tile.disabled ? "tg-dash-tile--muted" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const style = { "--tg-anim-i": index };

          if (tile.disabled || !tile.to) {
            return (
              <div
                key={`${tile.title}-${tile.subtitle}`}
                className={className}
                style={style}
                aria-disabled="true"
              >
                {body}
              </div>
            );
          }

          return (
            <Link
              key={`${tile.title}-${tile.subtitle}`}
              to={tile.to}
              className={className}
              style={style}
            >
              {body}
            </Link>
          );
        })}
      </section>

      <aside
        className="tg-dash-notes tg-anim-in"
        style={{ "--tg-anim-i": 6 }}
      >
        <h2>Quick tips</h2>
        <ul>
          <li>
            Generate papers from the built-in syllabus — no school setup needed.
          </li>
          <li>Saved papers stay in your Test Generator account only.</li>
          <li>
            Account Settings saves default fonts, sizes, and print layout for
            every paper.
          </li>
        </ul>
      </aside>
    </GeneratorLayout>
  );
}

export default GeneratorDashboard;
