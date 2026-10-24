import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

function looksUrduLabel(text) {
  return /[\u0600-\u06FF]/.test(String(text || ""));
}

/**
 * CustomSelect — CampusCloud reusable dropdown
 * options: [{ value: string, label: string, hint?: string, group?: string }]
 * type: "default" | "checkbox"
 *   - default: single select, closes on pick
 *   - checkbox: multi select, stays open; value is string[], onChange(string[])
 * When options include `group`, headings are rendered (non-selectable).
 */
function CustomSelect({
  value,
  options = [],
  onChange,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  emptyText = "No options found",
  disabled = false,
  searchable = true,
  type = "default",
  label,
  required = false,
  id,
  name,
  className = "",
  error = "",
}) {
  const isCheckbox = type === "checkbox";
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const triggerId = id || `${reactId}-trigger`;

  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedValues = useMemo(() => {
    if (isCheckbox) {
      if (Array.isArray(value)) return value.map(String);
      if (value == null || value === "") return [];
      return [String(value)];
    }
    return value == null || value === "" ? [] : [String(value)];
  }, [isCheckbox, value]);

  const selectedOptions = useMemo(
    () =>
      options.filter((option) => selectedValues.includes(String(option.value))),
    [options, selectedValues],
  );

  const selected = useMemo(
    () => (!isCheckbox ? selectedOptions[0] || null : null),
    [isCheckbox, selectedOptions],
  );

  const triggerLabel = useMemo(() => {
    if (!isCheckbox) return null;
    if (!selectedOptions.length) return null;
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    if (selectedOptions.length === 2) {
      return `${selectedOptions[0].label}, ${selectedOptions[1].label}`;
    }
    return `${selectedOptions.length} selected`;
  }, [isCheckbox, selectedOptions]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.hint || ""} ${option.group || ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [options, query]);

  /** Flat list with optional group headers for rendering / keyboard nav. */
  const listItems = useMemo(() => {
    const items = [];
    let lastGroup = null;
    let optionIndex = 0;
    const hasGroups = filtered.some((o) => o.group);

    for (const option of filtered) {
      const group = option.group || "";
      if (hasGroups && group && group !== lastGroup) {
        items.push({ kind: "header", key: `g-${group}`, label: group });
        lastGroup = group;
      }
      items.push({
        kind: "option",
        key: String(option.value),
        option,
        optionIndex,
      });
      optionIndex += 1;
    }
    return items;
  }, [filtered]);

  const showSearch = searchable && options.length > 5;

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && showSearch) {
      const timer = window.setTimeout(() => searchRef.current?.focus(), 20);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open, showSearch]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const selectOption = (optionValue) => {
    const nextValue = String(optionValue);

    if (isCheckbox) {
      const current = selectedValues;
      const exists = current.includes(nextValue);
      const next = exists
        ? current.filter((item) => item !== nextValue)
        : [...current, nextValue];
      onChange(next);
      return;
    }

    onChange(optionValue);
    setOpen(false);
    setQuery("");
  };

  const onTriggerKeyDown = (event) => {
    if (disabled) return;

    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (event) => {
    if (!filtered.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filtered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) selectOption(opt.value);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label ? (
        <label
          htmlFor={triggerId}
          className="mb-1.5 block text-sm font-medium text-navy"
        >
          {label} {required ? <span className="text-[#a33b4a]">*</span> : null}
        </label>
      ) : null}

      {name ? (
        <input
          type="hidden"
          name={name}
          value={isCheckbox ? selectedValues.join(",") : value || ""}
          readOnly
        />
      ) : null}

      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        onKeyDown={onTriggerKeyDown}
        className={[
          "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-bg-soft px-4 py-2.5 text-left transition duration-200",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender",
          open
            ? "border-lavender ring-2 ring-lavender/35"
            : error
              ? "border-[#a33b4a]/60"
              : "border-rose/60 hover:border-lavender/70",
          disabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      >
        <span className="min-w-0">
          {isCheckbox ? (
            triggerLabel ? (
              <span className="block truncate font-medium text-navy">
                {triggerLabel}
              </span>
            ) : (
              <span className="text-slate">{placeholder}</span>
            )
          ) : selected ? (
            <>
              <span
                className={[
                  "block font-medium text-navy leading-snug",
                  looksUrduLabel(selected.label)
                    ? "tg-font-urdu whitespace-normal"
                    : "truncate",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {selected.label}
              </span>
              {selected.hint ? (
                <span className="block truncate text-xs text-slate">
                  {selected.hint}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-slate">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={[
            "size-4 shrink-0 text-slate transition duration-200",
            open ? "rotate-180 text-navy" : "",
          ].join(" ")}
          aria-hidden="true"
        />
      </button>

      {error ? <p className="mt-1 text-xs text-[#a33b4a]">{error}</p> : null}

      {open ? (
        <div
          className="sms-select-panel absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl border border-rose/50 bg-white shadow-[0_18px_40px_rgb(31_34_50_/0.16)]"
          onKeyDown={onListKeyDown}
        >
          {showSearch ? (
            <div className="border-b border-rose/30 p-2">
              <div className="flex items-center gap-2 rounded-xl bg-bg-soft px-3 py-2">
                <Search
                  className="size-4 shrink-0 text-slate"
                  aria-hidden="true"
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-sm text-navy outline-none placeholder:text-slate/80"
                />
              </div>
            </div>
          ) : null}

          <ul
            id={listboxId}
            role="listbox"
            aria-multiselectable={isCheckbox || undefined}
            aria-labelledby={triggerId}
            className={[
              "max-h-60 overflow-y-auto p-1.5",
              isCheckbox ? "flex flex-col gap-1" : "",
            ].join(" ")}
          >
            {listItems.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate">{emptyText}</li>
            ) : (
              listItems.map((item) => {
                if (item.kind === "header") {
                  return (
                    <li
                      key={item.key}
                      role="presentation"
                      className="sticky top-0 z-[1] bg-white px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate/80"
                    >
                      {item.label}
                    </li>
                  );
                }

                const { option, optionIndex } = item;
                const isSelected = selectedValues.includes(
                  String(option.value),
                );
                const isActive = optionIndex === activeIndex;

                return (
                  <li
                    key={item.key}
                    role="option"
                    aria-selected={isSelected}
                    className={isCheckbox ? "isolate" : undefined}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(optionIndex)}
                      onClick={() => selectOption(option.value)}
                      className={[
                        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                        isCheckbox
                          ? isSelected
                            ? "bg-blush text-navy ring-1 ring-rose/35"
                            : isActive
                              ? "bg-blush/45 text-navy"
                              : "bg-white text-navy hover:bg-blush/35"
                          : isSelected
                            ? "bg-navy text-blush"
                            : isActive
                              ? "bg-blush text-navy"
                              : "text-navy hover:bg-blush/70",
                      ].join(" ")}
                    >
                      {isCheckbox ? (
                        <span
                          className={[
                            "grid size-4 shrink-0 place-items-center rounded border transition",
                            isSelected
                              ? "border-navy bg-navy text-blush"
                              : "border-rose/70 bg-white",
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          {isSelected ? (
                            <Check className="size-3" strokeWidth={3} />
                          ) : null}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span
                          className={[
                            "block text-sm font-medium leading-snug",
                            looksUrduLabel(option.label)
                              ? "tg-font-urdu whitespace-normal"
                              : "truncate",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {option.label}
                        </span>
                        {option.hint ? (
                          <span
                            className={[
                              "block truncate text-xs",
                              !isCheckbox && isSelected
                                ? "text-rose/90"
                                : "text-slate",
                            ].join(" ")}
                          >
                            {option.hint}
                          </span>
                        ) : null}
                      </span>
                      {!isCheckbox && isSelected ? (
                        <Check className="size-4 shrink-0" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default CustomSelect;
