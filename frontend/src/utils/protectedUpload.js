/**
 * Open an upload URL. Student files require auth (no longer public static).
 * Academy logos and external URLs open normally.
 */
export async function openProtectedUpload(url) {
  if (!url) return;

  const isStudentFile =
    typeof url === "string" && url.includes("/uploads/student-files/");

  if (!isStudentFile) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const filename = url.split("/").pop()?.split("?")[0];
  if (!filename) return;

  const token = localStorage.getItem("sms_token");
  const apiBase = import.meta.env.VITE_API_URL || "/api";
  const res = await fetch(
    `${apiBase}/uploads/student-files/${encodeURIComponent(filename)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  if (!res.ok) {
    throw new Error("Could not open file");
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
