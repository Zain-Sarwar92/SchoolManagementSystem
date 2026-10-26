import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

const DEFAULT_DURATION = 4200;
const EXIT_DURATION = 480;

let items = [];
let nextId = 1;
const listeners = new Set();

function emit() {
  const snapshot = [...items];
  listeners.forEach((listener) => listener(snapshot));
}

function removeToast(id) {
  items = items.filter((item) => item.id !== id);
  emit();
}

function dismissToast(id) {
  const target = items.find((item) => item.id === id);
  if (!target || target.leaving) return;
  items = items.map((item) =>
    item.id === id ? { ...item, leaving: true } : item
  );
  emit();
  window.setTimeout(() => removeToast(id), EXIT_DURATION);
}

function pushToast(variant, message, duration) {
  if (!message?.trim()) return;
  const id = nextId++;
  items = [...items, { id, variant, message, leaving: false, entered: false }];
  emit();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      items = items.map((item) =>
        item.id === id ? { ...item, entered: true } : item
      );
      emit();
    });
  });

  window.setTimeout(() => dismissToast(id), duration ?? DEFAULT_DURATION);
}

export const toast = {
  error: (message, duration) => pushToast("error", message, duration),
  success: (message, duration) => pushToast("success", message, duration),
  warning: (message, duration) => pushToast("warning", message, duration),
  info: (message, duration) => pushToast("info", message, duration),
};

const ICONS = {
  error: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

const SMS_VARIANT_STYLES = {
  success: "border-lavender/50 bg-navy text-blush",
  error: "border-rose bg-[#5c2430] text-blush",
  warning: "border-rose/70 bg-slate text-blush",
  info: "border-lavender/40 bg-slate text-blush",
};

function isGeneratorPath(pathname) {
  return (
    pathname.includes("/generator") ||
    pathname.includes("/academy/generator")
  );
}

export function Toaster() {
  const [visible, setVisible] = useState([]);
  const location = useLocation();
  const generator = isGeneratorPath(location.pathname);

  useEffect(() => {
    const listener = (next) => setVisible(next);
    listeners.add(listener);
    setVisible([...items]);
    return () => listeners.delete(listener);
  }, []);

  if (visible.length === 0) return null;

  return (
    <div
      className={[
        "pointer-events-none fixed z-[100] flex flex-col gap-2.5",
        generator
          ? "tg-toast-stack"
          : "inset-x-3 top-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[min(24rem,calc(100vw-2rem))]",
      ].join(" ")}
      role="region"
      aria-label="Notifications"
    >
      {visible.map((item) => {
        const Icon = ICONS[item.variant];
        const stateClass = item.leaving
          ? "sms-toast--out"
          : item.entered
            ? "sms-toast--in"
            : "sms-toast--start";

        return (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            className={[
              "sms-toast pointer-events-auto flex items-start gap-3",
              generator
                ? `tg-toast tg-toast--${item.variant}`
                : [
                    "rounded-2xl border px-4 py-3 shadow-[0_16px_40px_rgb(31_34_50_/0.28)]",
                    SMS_VARIANT_STYLES[item.variant],
                  ].join(" "),
              stateClass,
            ].join(" ")}
          >
            <span
              className={
                generator
                  ? "tg-toast-icon"
                  : "mt-0.5 shrink-0"
              }
              aria-hidden="true"
            >
              <Icon className={generator ? undefined : "size-4"} />
            </span>
            <p
              className={
                generator
                  ? "tg-toast-msg"
                  : "min-w-0 flex-1 break-words text-sm font-medium"
              }
            >
              {item.message}
            </p>
            <button
              type="button"
              className={
                generator
                  ? "tg-toast-dismiss"
                  : "cursor-pointer rounded-lg p-1 opacity-80 transition hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lavender"
              }
              onClick={() => dismissToast(item.id)}
              aria-label="Dismiss notification"
            >
              <X className={generator ? undefined : "size-3.5"} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
