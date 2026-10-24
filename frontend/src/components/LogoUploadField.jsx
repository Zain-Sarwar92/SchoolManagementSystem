import { useId, useState } from "react";
import { ImagePlus, Link2, Upload } from "lucide-react";

function LogoUploadField({
  file,
  logoUrl,
  onFileChange,
  onUrlChange,
  required = true,
}) {
  const fileId = useId();
  const [mode, setMode] = useState("upload");
  const [preview, setPreview] = useState("");

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    onFileChange(nextFile);
    onUrlChange("");

    setPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return nextFile ? URL.createObjectURL(nextFile) : "";
    });
  };

  const handleUrlChange = (value) => {
    onUrlChange(value);
    onFileChange(null);
    setPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return value.trim();
    });
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    onFileChange(null);
    onUrlChange("");
    setPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return "";
    });
  };

  const displayPreview = mode === "upload" ? preview : logoUrl.trim() || preview;

  return (
    <div className="sm:col-span-2 rounded-2xl border border-rose/40 bg-blush/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-navy">
          Academy Logo {required && <span className="text-[#a33b4a]">*</span>}
        </p>
        <div className="inline-flex rounded-xl bg-white/80 p-1">
          <button
            type="button"
            onClick={() => switchMode("upload")}
            className={[
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lavender",
              mode === "upload" ? "bg-navy text-blush" : "text-slate hover:text-navy",
            ].join(" ")}
          >
            <Upload className="size-3.5" aria-hidden="true" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => switchMode("url")}
            className={[
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lavender",
              mode === "url" ? "bg-navy text-blush" : "text-slate hover:text-navy",
            ].join(" ")}
          >
            <Link2 className="size-3.5" aria-hidden="true" />
            Paste URL
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-stretch">
        <div className="mx-auto flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-rose/50 bg-white sm:mx-0">
          {displayPreview ? (
            <img
              src={displayPreview}
              alt=""
              className="h-full w-full object-contain p-1.5"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <ImagePlus className="size-8 text-slate" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {mode === "upload" ? (
            <label
              htmlFor={fileId}
              className="flex min-h-[6rem] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-lavender/60 bg-white/70 px-4 py-3 text-center transition hover:border-lavender hover:bg-white focus-within:outline focus-within:outline-2 focus-within:outline-lavender"
            >
              <Upload className="mb-1 size-4 text-navy" aria-hidden="true" />
              <span className="text-sm font-semibold text-navy">
                {file?.name || "Click to upload logo"}
              </span>
              <span className="mt-0.5 text-xs text-slate">
                JPG, PNG, WEBP, or GIF · max 2 MB
              </span>
              <input
                id={fileId}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="flex min-h-[6rem] flex-col justify-center rounded-2xl border border-dashed border-lavender/60 bg-white/70 px-4 py-3">
              <label htmlFor={`${fileId}-url`} className="mb-1.5 text-sm font-medium text-navy">
                Image URL
              </label>
              <input
                id={`${fileId}-url`}
                type="url"
                value={logoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-xl border border-rose/60 bg-bg-soft px-3 py-2.5 text-sm text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40"
              />
              <p className="mt-1.5 text-xs text-slate">JPG, PNG, WEBP, GIF or https URL</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LogoUploadField;
