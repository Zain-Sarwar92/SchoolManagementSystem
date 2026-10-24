/** Map common section colour names → swatch */
export const sectionSwatch = (name = "") => {
  const key = name.trim().toLowerCase();
  const map = {
    red: "#c45c68",
    blue: "#4a6fa5",
    green: "#3f8f6b",
    yellow: "#c9a227",
    orange: "#d9773a",
    purple: "#8b6bb5",
    pink: "#d4849a",
    white: "#f5f0f1",
    black: "#1f2232",
  };
  return map[key] || "#bc9ec1";
};
