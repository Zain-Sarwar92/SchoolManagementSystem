import { useEffect, useState } from "react";
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

/** One toast look app-wide (login, generator, academy). */
export function Toaster() {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    const listener = (next) => setVisible(next);
    listeners.add(listener);
    setVisible([...items]);
    return () => listeners.delete(listener);
  }, []);

  if (visible.length === 0) return null;

  return (
    <div
      className="pointer-events-none tg-toast-stack fixed z-[100] flex flex-col gap-2.5"
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
              `tg-toast tg-toast--${item.variant}`,
              stateClass,
            ].join(" ")}
          >
            <span className="tg-toast-icon" aria-hidden="true">
              <Icon />
            </span>
            <p className="tg-toast-msg">{item.message}</p>
            <button
              type="button"
              className="tg-toast-dismiss"
              onClick={() => dismissToast(item.id)}
              aria-label="Dismiss notification"
            >
              <X />
            </button>
          </div>
        );
      })}
    </div>
  );
}
