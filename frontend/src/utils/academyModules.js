export const ACADEMY_PRODUCTS = [
  {
    key: "moduleAcademyManagement",
    flag: "ACADEMY_MANAGEMENT",
    label: "Academy Management",
    description: "Students, fees, results, classes, and school operations",
  },
  {
    key: "moduleTestGenerator",
    flag: "TEST_GENERATOR",
    label: "Test Generator",
    description: "Standalone paper generator — fully separate from school management",
  },
];

function readFlag(academy, field) {
  if (!academy) return false;
  if (academy[field] === undefined || academy[field] === null) return true;
  return Boolean(academy[field]);
}

export function flagsFromAcademy(academy) {
  if (!academy) {
    return { ACADEMY_MANAGEMENT: false, TEST_GENERATOR: false };
  }
  return {
    ACADEMY_MANAGEMENT: readFlag(academy, "moduleAcademyManagement"),
    TEST_GENERATOR: readFlag(academy, "moduleTestGenerator"),
  };
}

export function academyHasModule(academy, flag) {
  return Boolean(flagsFromAcademy(academy)[flag]);
}

export function isTestGeneratorOnly(academy) {
  const flags = flagsFromAcademy(academy);
  return flags.TEST_GENERATOR && !flags.ACADEMY_MANAGEMENT;
}

const CORE_PATHS = new Set(["/academy"]);

/** Pure Academy Management surface */
const MANAGEMENT_PREFIXES = [
  "/academy/classes",
  "/academy/sections",
  "/academy/teachers",
  "/academy/students",
  "/academy/fees",
  "/academy/results",
  "/academy/schedules",
];

/** Pure Test Generator surface — zero AM coupling */
const GENERATOR_PREFIXES = ["/academy/generator"];

export function filterAcademyNavItems(navItems, academy) {
  const flags = flagsFromAcademy(academy);
  const hasMgmt = flags.ACADEMY_MANAGEMENT;
  const hasTests = flags.TEST_GENERATOR;

  if (!hasMgmt && !hasTests) {
    return navItems.filter((item) => item.to === "/academy");
  }

  return navItems.filter((item) => {
    const path = item.to;
    if (CORE_PATHS.has(path)) return true;

    if (GENERATOR_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return hasTests;
    }

    if (MANAGEMENT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return hasMgmt;
    }

    return hasMgmt;
  });
}

export function filterTeacherNavItems(navItems, academy) {
  const hasMgmt = academyHasModule(academy, "ACADEMY_MANAGEMENT");
  const hasTests = academyHasModule(academy, "TEST_GENERATOR");

  return navItems.filter((item) => {
    const path = item.to;
    if (path === "/teacher") return true;
    if (path.startsWith("/teacher/")) return hasMgmt;
    if (path.startsWith("/academy/generator")) return hasTests;
    return hasMgmt;
  });
}
