import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  FilePlus2,
  FolderOpen,
  Settings2,
  UsersRound,
} from "lucide-react";
import GeneratorLayout from "../components/GeneratorLayout.jsx";
import StatusPanel from "../components/StatusPanel.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import api from "../../../services/api.js";

/**
 * Module tiles — visual language matches syllabus cards.
 */
const TILES = [
  {
    to: "/academy/generator",
    title: "Generate Paper",
    subtitle: "Method 1",
    icon: FilePlus2,
  },
  {
    to: "/academy/generator/papers",
    title: "Saved Papers",
    subtitle: "Download / Print",
    icon: FolderOpen,
    countKey: "papers",
    tone: 3,
  },
  {
    to: "/academy/generator/sub-accounts",
    title: "Sub Accounts",
    subtitle: "Create subuser logins",
    icon: UsersRound,
    countKey: "users",
    tone: 4,
  },
  {
    to: "/academy/generator/activities",
    title: "Account Activities",
    subtitle: "Audit log",
    icon: ClipboardList,
    tone: 5,
  },
  {
    to: "/academy/generator/settings",
    title: "Account Settings",
    subtitle: "Fonts, sizes & print",
    icon: Settings2,
    tone: 6,
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
        <h1 className="tg-dash-title">Dashboard</h1>
        <p className="tg-dash-sub">
          {[user?.name, user?.academy?.name]
            .filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .join(" · ") || "Paper generator"}
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
          const countEl =
            tile.countKey == null ? null : statsLoading && count == null ? (
              <span className="tg-dash-tile-count tg-dash-tile-count--skel" aria-hidden />
            ) : (
              <span className="tg-dash-tile-count">{count ?? 0}</span>
            );

          return (
            <Link
              key={`${tile.title}-${tile.subtitle}`}
              to={tile.to}
              className={[
                "tg-dash-tile",
                "tg-anim-in",
                tile.tone ? `tg-dash-tone-${tile.tone}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ "--tg-anim-i": index }}
            >
              {countEl}
              <span className="tg-dash-tile-icon" aria-hidden>
                <Icon strokeWidth={1.75} className="size-7" />
              </span>
              <span className="tg-dash-tile-copy">
                <h3>{tile.title}</h3>
                <p>{tile.subtitle}</p>
              </span>
            </Link>
          );
        })}
      </section>
    </GeneratorLayout>
  );
}

export default GeneratorDashboard;
