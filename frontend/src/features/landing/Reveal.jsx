import { useEffect, useRef } from "react";

/**
 * Scroll-in reveal. Replays when you leave and enter the viewport again.
 * `instant` stays visible (hero).
 */
export function Reveal({
  as: Tag = "div",
  className = "",
  children,
  delay = 0,
  from = "up",
  instant = false,
  ...rest
}) {
  const ref = useRef(null);
  const timerRef = useRef(0);

  useEffect(() => {
    if (instant) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("pp-reveal--in");
      return undefined;
    }

    const clearTimer = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = 0;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        clearTimer();
        if (entry.isIntersecting) {
          timerRef.current = window.setTimeout(() => {
            el.classList.add("pp-reveal--in");
            timerRef.current = 0;
          }, Math.max(0, delay));
        } else {
          el.classList.remove("pp-reveal--in");
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);

    return () => {
      clearTimer();
      io.disconnect();
    };
  }, [delay, instant]);

  return (
    <Tag
      ref={ref}
      className={[
        "pp-reveal",
        `pp-reveal--${from}`,
        instant ? "pp-reveal--in" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </Tag>
  );
}
