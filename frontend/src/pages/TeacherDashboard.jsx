import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, FilePlus2, Files } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { GeneratorLayout } from "../features/generator/index.js";
import { useTeacherNav } from "../hooks/useAcademyNav.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  academyHasModule,
  isTestGeneratorOnly,
} from "../utils/academyModules.js";

function TeacherDashboard() {
  const navItems = useTeacherNav();
  const { user } = useAuth();
  const hasTests = academyHasModule(user?.academy, "TEST_GENERATOR");
  const hasMgmt = academyHasModule(user?.academy, "ACADEMY_MANAGEMENT");
  const tgOnly = isTestGeneratorOnly(user?.academy);

  if (tgOnly || (hasTests && !hasMgmt)) {
    return (
      <GeneratorLayout>
        <div className="mb-5 sm:mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-tg-blue">
            Welcome
          </p>
          <h1 className="font-display text-2xl font-bold text-tg-ink sm:text-3xl">
            {user?.name || "Teacher"}
          </h1>
          <p className="mt-1 text-sm text-tg-ink/70">
            {user?.academy?.name || "Test Generator"} · Sub account
          </p>
        </div>
        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/academy/generator"
            className="relative flex min-h-[8.25rem] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-tg-sky to-tg-blue p-4 text-tg-cream shadow-lg transition hover:-translate-y-0.5 sm:min-h-[9rem] sm:rounded-3xl sm:p-5"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-white/18">
              <FilePlus2 className="size-5" aria-hidden />
            </span>
            <span className="mt-4 block">
              <span className="block font-display text-lg font-bold sm:text-xl">
                Generate Paper
              </span>
              <span className="mt-1 block text-sm text-tg-cream/85">
                Create a new exam paper
              </span>
            </span>
          </Link>
          <Link
            to="/academy/generator/papers"
            className="relative flex min-h-[8.25rem] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-tg-ink to-tg-navy p-4 text-tg-cream shadow-lg transition hover:-translate-y-0.5 sm:min-h-[9rem] sm:rounded-3xl sm:p-5"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-white/18">
              <Files className="size-5" aria-hidden />
            </span>
            <span className="mt-4 block">
              <span className="block font-display text-lg font-bold sm:text-xl">
                Saved Papers
              </span>
              <span className="mt-1 block text-sm text-tg-cream/85">
                Open, edit, or print your papers
              </span>
            </span>
          </Link>
        </section>
      </GeneratorLayout>
    );
  }

  return (
    <DashboardLayout title="Teacher" navItems={navItems}>
      <section className="sms-surface space-y-4 rounded-2xl p-5 sm:rounded-3xl sm:p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-navy">
            Hi {user?.name || "Teacher"}
          </h2>
          <p className="mt-1 text-sm text-slate">
            {hasMgmt
              ? "Your assigned tests appear under My tests."
              : "Use Test Generator to create and print papers."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasMgmt ? (
            <Link
              to="/teacher/schedules"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-navy px-3 text-sm font-semibold text-blush"
            >
              <CalendarClock className="size-4" />
              Open my tests
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
          {hasTests ? (
            <Link
              to="/academy/generator"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-navy/20 bg-white px-3 text-sm font-semibold text-navy"
            >
              <FilePlus2 className="size-4" />
              Generate paper
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </section>
    </DashboardLayout>
  );
}

export default TeacherDashboard;
