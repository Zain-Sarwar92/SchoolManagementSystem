/**
 * Account Activities — reusable category + action labels.
 * Click a category heading to filter that group of logs.
 */

export const ACTION_LABELS = {
  LOGIN: "Login",
  PAPER_CREATE: "Paper created",
  PAPER_UPDATE: "Paper updated",
  PAPER_DELETE: "Paper deleted",
  PAPER_PRINT: "Paper printed",
  TEACHER_CREATE: "Teacher created",
  TEACHER_UPDATE: "Teacher updated",
  TEACHER_DELETE: "Teacher deleted",
  SUB_ACCOUNT_CREATE: "Sub account created",
  SUB_ACCOUNT_UPDATE: "Sub account updated",
  SUB_ACCOUNT_DELETE: "Sub account deleted",
};

export const ACTION_TONES = {
  LOGIN: "bg-sky-100 text-sky-800",
  PAPER_CREATE: "bg-emerald-100 text-emerald-800",
  PAPER_UPDATE: "bg-amber-100 text-amber-900",
  PAPER_DELETE: "bg-rose-100 text-rose-800",
  PAPER_PRINT: "bg-violet-100 text-violet-800",
  TEACHER_CREATE: "bg-teal-100 text-teal-800",
  TEACHER_UPDATE: "bg-orange-100 text-orange-900",
  TEACHER_DELETE: "bg-rose-100 text-rose-800",
  SUB_ACCOUNT_CREATE: "bg-teal-100 text-teal-800",
  SUB_ACCOUNT_UPDATE: "bg-orange-100 text-orange-900",
  SUB_ACCOUNT_DELETE: "bg-rose-100 text-rose-800",
};

/**
 * Heading tabs on the activities page.
 * `actions: null` = all; otherwise server filters with $in.
 */
export const ACTIVITY_CATEGORIES = [
  {
    id: "all",
    label: "All",
    actions: null,
  },
  {
    id: "login",
    label: "Login",
    actions: ["LOGIN"],
  },
  {
    id: "paper_generation",
    label: "Paper generation",
    actions: ["PAPER_CREATE"],
  },
  {
    id: "paper_updates",
    label: "Paper updates",
    actions: ["PAPER_UPDATE"],
  },
  {
    id: "paper_deletion",
    label: "Paper deletion",
    actions: ["PAPER_DELETE"],
  },
  {
    id: "paper_print",
    label: "Paper print",
    actions: ["PAPER_PRINT"],
  },
  {
    id: "sub_accounts",
    label: "Sub accounts",
    actions: [
      "SUB_ACCOUNT_CREATE",
      "SUB_ACCOUNT_UPDATE",
      "SUB_ACCOUNT_DELETE",
    ],
  },
];

export function categoryById(id) {
  return (
    ACTIVITY_CATEGORIES.find((c) => c.id === id) || ACTIVITY_CATEGORIES[0]
  );
}

/** Sum counts for a category from { ACTION: n } map */
export function categoryCount(category, countsByAction = {}) {
  if (!category?.actions) {
    return Object.values(countsByAction).reduce(
      (sum, n) => sum + (Number(n) || 0),
      0
    );
  }
  return category.actions.reduce(
    (sum, action) => sum + (Number(countsByAction[action]) || 0),
    0
  );
}

export function roleLabel(role) {
  if (role === "academy_admin") return "Admin";
  if (role === "teacher") return "Teacher";
  if (role === "sub_account") return "Sub account";
  if (role === "super_admin") return "Super Admin";
  return role || "—";
}

export function formatActivityWhen(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
