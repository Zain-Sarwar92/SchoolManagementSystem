import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  FileStack,
  Fingerprint,
  Languages,
  Layers3,
  Printer,
  RefreshCw,
  Scale,
  ShieldCheck,
  Shuffle,
  Users,
} from "lucide-react";
import { Reveal } from "../features/landing/Reveal.jsx";
import "../features/landing/landing.css";

const FEATURES = [
  {
    icon: Scale,
    title: "Chapter-weighted papers",
    body: "Select multiple chapters, then set MCQ / Short / Long counts per chapter so the paper follows your teaching weight.",
  },
  {
    icon: Shuffle,
    title: "Smart topic spread",
    body: "Random pick spreads questions across topics — you don’t get a stack of items from the same topic.",
  },
  {
    icon: FileStack,
    title: "Section builder",
    body: "Assemble MCQ, short, and long parts with marks, required counts, and board-style attempt rules.",
  },
  {
    icon: RefreshCw,
    title: "Replace any question",
    body: "One-click refresh swaps a weak item for another from the same syllabus pool — keep the paper shape intact.",
  },
  {
    icon: Languages,
    title: "English, Urdu & dual",
    body: "Generate and print for bilingual classrooms with medium controls that match your board paper style.",
  },
  {
    icon: Printer,
    title: "Academy-branded print",
    body: "Logo headers, multiple layouts, watermarks, bubble sheets, and answer keys ready for class.",
  },
  {
    icon: Layers3,
    title: "Saved papers workspace",
    body: "Every paper stays in your academy account — edit, reprint, and share with teachers anytime.",
  },
  {
    icon: Users,
    title: "Staff & sub-accounts",
    body: "Teachers get their own login. Admins see all papers; staff only manage their own.",
  },
  {
    icon: Fingerprint,
    title: "Activity audit + school ops",
    body: "Track who created or printed papers — and optionally add students, fees, and results in the same product.",
  },
];

const DIFFS = [
  {
    title: "Chapter planner, not blind random",
    body: "Weight every chapter by question type so coverage matches what you taught.",
  },
  {
    title: "Topic-balanced selection",
    body: "Smart pick avoids dumping multiple questions from one narrow topic.",
  },
  {
    title: "Your academy workspace",
    body: "Saved papers, branding, staff logins, and audit — not a public generate-and-go site.",
  },
  {
    title: "Optional full school ops",
    body: "Layer fees, results, and students when you want more than papers alone.",
  },
];

function Landing() {
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="pp-landing">
      <header className={`pp-nav${navScrolled ? " pp-nav--scrolled" : ""}`}>
        <a href="#top" className="pp-nav-brand">
          Paper <span>PRO</span>
        </a>
        <div className="pp-nav-actions">
          <a href="#features" className="pp-link">
            Features
          </a>
          <a href="#difference" className="pp-link">
            Why Paper PRO
          </a>
          <Link to="/login" className="pp-cta-btn pp-cta-btn--ghost">
            Login
          </Link>
          <a href="#demo" className="pp-cta-btn pp-cta-btn--solid">
            Request demo
          </a>
        </div>
      </header>

      <main id="top">
        <section className="pp-hero" aria-label="Paper PRO hero">
          <div className="pp-hero-media" aria-hidden="true">
            <img
              className="pp-hero-photo"
              src="/landing/paper-pro-hero-teacher.png?v=5"
              alt=""
              width={1920}
              height={1080}
              decoding="async"
              fetchPriority="high"
            />
            <div className="pp-hero-scrim" />
          </div>
          <div className="pp-hero-content">
            <Reveal as="p" className="pp-hero-brand" from="far" delay={40} instant>
              Paper <em>PRO</em>
            </Reveal>
            <Reveal as="h1" className="pp-hero-title" from="far" delay={140} instant>
              Board papers for your academy, in minutes
            </Reveal>
            <Reveal as="p" className="pp-hero-lead" from="up" delay={240} instant>
              Chapter-weighted selection, topic-balanced random pick, branded
              print — built for academies that set papers every week.
            </Reveal>
            <Reveal className="pp-hero-ctas" from="up" delay={340} instant>
              <a href="#demo" className="pp-cta-btn pp-cta-btn--accent pp-cta-btn--lg">
                Book a demo
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <Link to="/login" className="pp-cta-btn pp-cta-btn--ghost pp-cta-btn--lg">
                Staff login
              </Link>
            </Reveal>
          </div>
        </section>

        <section id="features" className="pp-section pp-section--soft">
          <div className="pp-section-inner">
            <Reveal as="p" className="pp-kicker" from="left">
              What you get
            </Reveal>
            <Reveal as="h2" className="pp-h2" from="far" delay={80}>
              Built for academies that print every week
            </Reveal>
            <Reveal as="p" className="pp-sub" from="up" delay={140}>
              From chapter-weighted selection to topic-balanced random pick —
              built for how academies actually set papers.
            </Reveal>
            <div className="pp-feature-grid">
              {FEATURES.map((item, i) => {
                const Icon = item.icon;
                return (
                  <Reveal
                    key={item.title}
                    className="pp-feature"
                    from="up"
                    delay={80 + i * 70}
                  >
                    <div className="pp-feature-top">
                      <div className="pp-feature-icon" aria-hidden="true">
                        <Icon className="size-5" strokeWidth={2} />
                      </div>
                      <span className="pp-feature-num" aria-hidden="true">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="difference" className="pp-section pp-section--muted">
          <div className="pp-section-inner pp-diff">
            <div>
              <Reveal as="p" className="pp-kicker" from="left">
                Not just another paper site
              </Reveal>
              <Reveal as="h2" className="pp-h2" from="far" delay={70}>
                Different from public paper generators
              </Reveal>
            <Reveal as="p" className="pp-sub" from="up" delay={120}>
              Public sites generate a paper. Paper PRO plans chapter weight,
              spreads topics, saves the draft, and brands the print for your campus.
            </Reveal>
            </div>
            <ul className="pp-diff-list">
              {DIFFS.map((item, i) => (
                <Reveal as="li" key={item.title} from="right" delay={90 + i * 80}>
                  <span className="pp-diff-icon" aria-hidden="true">
                    <ShieldCheck className="size-5" strokeWidth={2} />
                  </span>
                  <div className="pp-diff-copy">
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <section className="pp-section pp-section--soft-alt">
          <div className="pp-section-inner">
            <Reveal as="p" className="pp-kicker" from="left">
              How it works
            </Reveal>
            <Reveal as="h2" className="pp-h2" from="far" delay={70}>
              Three steps to a classroom paper
            </Reveal>
            <Reveal as="p" className="pp-sub" from="up" delay={120}>
              From syllabus to stack of printed sheets — without leaving your
              academy workspace.
            </Reveal>
            <div className="pp-steps">
              {[
                {
                  title: "Choose the syllabus",
                  body: "Pick class, subject, and multiple chapters — then set type counts per chapter.",
                },
                {
                  title: "Smart assemble",
                  body: "Random or balanced pick spreads topics; swap any question; set marks and attempts.",
                },
                {
                  title: "Print with your brand",
                  body: "Save the paper, open print layouts, and walk into class ready.",
                },
              ].map((step, i) => (
                <Reveal key={step.title} className="pp-step" from="up" delay={100 + i * 90}>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="pp-final">
          <div className="pp-section-inner">
            <Reveal as="p" className="pp-kicker" from="left">
              For academy owners
            </Reveal>
            <Reveal as="h2" className="pp-h2" from="far" delay={80}>
              Ready to pitch Paper PRO to your campus?
            </Reveal>
            <Reveal as="p" className="pp-sub" from="up" delay={140}>
              Book a short demo. We’ll walk through paper generation, branding,
              staff logins, and whether school management fits your academy.
            </Reveal>
            <Reveal className="pp-final-actions" from="up" delay={220}>
              <a
                href="mailto:zainishere26@gmail.com?subject=Paper%20PRO%20demo%20request"
                className="pp-cta-btn pp-cta-btn--accent pp-cta-btn--lg"
              >
                Email for demo
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <Link to="/login" className="pp-cta-btn pp-cta-btn--on-dark pp-cta-btn--lg">
                Already a customer? Login
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="pp-footer">
        <p>
          <strong>Paper PRO</strong> — board papers & academy tools
        </p>
        <p>© {new Date().getFullYear()} Paper PRO</p>
      </footer>
    </div>
  );
}

export default Landing;
