export const ACADEMY_MODULES = {
  ACADEMY_MANAGEMENT: {
    field: "moduleAcademyManagement",
    label: "Academy Management",
    description: "Students, fees, results, and day-to-day school operations",
  },
  TEST_GENERATOR: {
    field: "moduleTestGenerator",
    label: "Test Generator",
    description: "Test schedules, teacher assignments, and printable papers",
  },
};

/** Legacy docs without fields keep both products enabled. */
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

export function parseModuleFlags(body = {}) {
  const toBool = (value) => {
    if (typeof value === "boolean") return value;
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "on";
  };

  return {
    moduleAcademyManagement: toBool(body.moduleAcademyManagement),
    moduleTestGenerator: toBool(body.moduleTestGenerator),
  };
}

export function academyHasModule(academy, moduleKey) {
  return Boolean(flagsFromAcademy(academy)[moduleKey]);
}
