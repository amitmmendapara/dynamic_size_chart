import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  Upload,
  X,
  Eye,
  Info,
  AlertCircle,
  Ruler,
  Check,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  getSizeChart,
  saveSizeChart,
  uploadSizeChartImage,
  deleteSizeChartImage,
  resolveImageUrl,
} from "../api/sizeChartApi";

/* ---------------------------------------------------------------------
   Tokens (see design plan in conversation):
   - ink:      #1C1A17  (near-black, warm)
   - paper:    #F1EEE7  (worksheet cream — muted, not the AI-cream default;
               used only as page backdrop, not the card surface)
   - surface:  #FFFFFF
   - line:     #DFDAD0  (tape/paper edge)
   - wine:     #7A2E2E  (tailor's chalk marking — primary accent)
   - wine-ink: #5C2020
   - brass:    #A9803D  (tape-measure brass — secondary accent)
   - ok:       #3F6C4B
   - display font: "Barlow Condensed" (label/eyebrow, tag-like)
   - body font: "Inter"
   - mono font (numbers): "IBM Plex Mono" — tape-measure digits
------------------------------------------------------------------------ */

const FONT_LINK_ID = "sizechart-fonts";
if (typeof document !== "undefined" && !document.getElementById(FONT_LINK_ID)) {
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap";
  document.head.appendChild(link);
}

const STANDARD_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36"];

const CATEGORY_PRESETS = {
  "T-Shirts": ["Chest", "Length", "Shoulder"],
  Jeans: ["Waist", "Hip", "Inseam", "Length"],
  Shoes: ["UK Size", "US Size", "EU Size", "Foot Length"],
};

const DEFAULT_COLUMNS = ["Chest", "Waist", "Hip", "Length"];
const DEFAULT_ROWS = {
  XS: { Chest: "34", Waist: "28", Hip: "34", Length: "26" },
  S: { Chest: "36", Waist: "30", Hip: "36", Length: "27" },
  M: { Chest: "38", Waist: "32", Hip: "38", Length: "28" },
  L: { Chest: "40", Waist: "34", Hip: "40", Length: "29" },
  XL: { Chest: "42", Waist: "36", Hip: "42", Length: "30" },
};

let uid = 0;
const nextId = () => `id_${++uid}_${Math.random().toString(36).slice(2, 7)}`;

function makeColumn(name) {
  return { id: nextId(), name };
}
function makeRow(size, values = {}) {
  return { id: nextId(), size, values };
}

/* --- small building blocks --- */

function Eyebrow({ children }) {
  return (
    <div
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        letterSpacing: "0.14em",
        fontWeight: 600,
      }}
      className="text-[11px] uppercase text-[#A9803D]"
    >
      {children}
    </div>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-[12px] text-[#B23B3B]">
      <AlertCircle size={12} strokeWidth={2.5} />
      {children}
    </p>
  );
}

function Toggle({ checked, onChange, label, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 focus:outline-none"
    >
      <span
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200"
        style={{ backgroundColor: checked ? "#7A2E2E" : "#D8D2C6" }}
      >
        <span
          className="inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-200"
          style={{
            height: 18,
            width: 18,
            transform: checked ? "translateX(22px)" : "translateX(3px)",
          }}
        />
      </span>
      {label && (
        <span className="text-[14px] font-medium text-[#1C1A17]">{label}</span>
      )}
    </button>
  );
}

/* ---------------------------------------------------------------------
   Main section
------------------------------------------------------------------------ */

export default function SizeChartSection({ productId = 1 }) {
  const [enabled, setEnabled] = useState(true);
  const [chartType, setChartType] = useState("Standard");
  const [unit, setUnit] = useState("in");
  const [columns, setColumns] = useState(DEFAULT_COLUMNS.map(makeColumn));
  const [rows, setRows] = useState(
    Object.entries(DEFAULT_ROWS).map(([size, values]) => makeRow(size, values))
  );
  const [newColumnName, setNewColumnName] = useState("");
  const [newSizeName, setNewSizeName] = useState("");
  const [image, setImage] = useState(null); // {name, dataUrl, size}
  const [imageError, setImageError] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [touched, setTouched] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef(null);

  // --- load the saved chart for this product on mount ---
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSizeChart(productId)
      .then((chart) => {
        if (cancelled || !chart) return;
        setEnabled(chart.enabled);
        setChartType(chart.chartType || "Standard");
        setUnit(chart.unit || "in");
        setColumns(
          (chart.columns || []).map((c) => ({ id: `col_${c.id}`, name: c.name }))
        );
        setRows(
          (chart.rows || []).map((r) => ({
            id: `row_${r.id}`,
            size: r.size,
            values: r.values || {},
          }))
        );
        if (chart.image) {
          setImage({
            name: chart.image.name,
            size: chart.image.size,
            dataUrl: resolveImageUrl(chart.image.url),
          });
        }
      })
      .catch((err) => setSaveError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Demo-only: simulates the product's variant sizes, to show auto-recognition.
  const variantSizes = ["S", "M", "L", "XL"];
  const [removedVariantWarning, setRemovedVariantWarning] = useState("");

  // --- column helpers, keyed by column name since rows store values by name ---
  function addColumn(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (columns.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    setColumns((cols) => [...cols, makeColumn(trimmed)]);
    setNewColumnName("");
  }

  function removeColumn(id) {
    const col = columns.find((c) => c.id === id);
    setColumns((cols) => cols.filter((c) => c.id !== id));
    if (col) {
      setRows((rs) =>
        rs.map((r) => {
          const { [col.name]: _drop, ...rest } = r.values;
          return { ...r, values: rest };
        })
      );
    }
  }

  function applyPreset(category) {
    const names = CATEGORY_PRESETS[category];
    setColumns(names.map(makeColumn));
    setRows((rs) =>
      rs.map((r) => {
        const values = {};
        names.forEach((n) => {
          values[n] = r.values[n] ?? "";
        });
        return { ...r, values };
      })
    );
  }

  function addRow(sizeName) {
    const trimmed = (sizeName ?? newSizeName).trim();
    if (!trimmed) return;
    if (rows.some((r) => r.size.toLowerCase() === trimmed.toLowerCase())) return;
    setRows((rs) => [...rs, makeRow(trimmed)]);
    setNewSizeName("");
  }

  function removeRow(id) {
    const row = rows.find((r) => r.id === id);
    setRows((rs) => rs.filter((r) => r.id !== id));
    if (row && variantSizes.includes(row.size)) {
      setRemovedVariantWarning(
        `"${row.size}" is one of this product's variant sizes. Customers who select ${row.size} at checkout will no longer see a matching measurement row.`
      );
    }
  }

  function updateRowSize(id, size) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, size } : r)));
  }

  function updateCell(rowId, colName, value) {
    setRows((rs) =>
      rs.map((r) =>
        r.id === rowId ? { ...r, values: { ...r.values, [colName]: value } } : r
      )
    );
  }

  async function handleImageFile(file) {
    setImageError("");
    if (!file) return;
    const okTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!okTypes.includes(file.type)) {
      setImageError("Use a JPG, PNG, or WEBP file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image must be 5 MB or smaller.");
      return;
    }
    // Show an instant local preview, then swap in the uploaded URL.
    const localPreview = URL.createObjectURL(file);
    setImage({ name: file.name, dataUrl: localPreview, size: file.size });
    setImageUploading(true);
    try {
      const chart = await uploadSizeChartImage(productId, file);
      setImage({
        name: chart.image.name,
        size: chart.image.size,
        dataUrl: resolveImageUrl(chart.image.url),
      });
    } catch (err) {
      setImageError(err.message || "Upload failed. Try again.");
      setImage(null);
    } finally {
      setImageUploading(false);
    }
  }

  async function handleRemoveImage() {
    setImageError("");
    try {
      await deleteSizeChartImage(productId);
    } catch (err) {
      setImageError(err.message || "Couldn't remove image. Try again.");
      return;
    }
    setImage(null);
  }

  // --- validation ---
  const errors = useMemo(() => {
    const e = { rows: {}, columns: {}, general: [] };
    if (!enabled) return e;

    if (rows.length === 0) {
      e.general.push("Add at least one size before saving.");
    }

    const seenSizes = new Map();
    rows.forEach((r) => {
      const rowErr = { size: "", values: {} };
      if (!r.size.trim()) {
        rowErr.size = "Size name is required.";
      } else {
        const key = r.size.trim().toLowerCase();
        if (seenSizes.has(key)) {
          rowErr.size = "Duplicate size name.";
        }
        seenSizes.set(key, true);
      }
      columns.forEach((c) => {
        const v = r.values[c.name];
        if (v === undefined || v === "") return;
        if (isNaN(Number(v))) {
          rowErr.values[c.name] = "Numbers only.";
        } else if (Number(v) < 0) {
          rowErr.values[c.name] = "Cannot be negative.";
        }
      });
      if (rowErr.size || Object.keys(rowErr.values).length) {
        e.rows[r.id] = rowErr;
      }
    });

    const seenCols = new Map();
    columns.forEach((c) => {
      const key = c.name.trim().toLowerCase();
      if (seenCols.has(key)) {
        e.columns[c.id] = "Duplicate column.";
      }
      seenCols.set(key, true);
    });

    return e;
  }, [enabled, rows, columns]);

  const hasErrors =
    Object.keys(errors.rows).length > 0 ||
    Object.keys(errors.columns).length > 0 ||
    errors.general.length > 0;

  async function handleSave() {
    setTouched(true);
    setSaveError("");
    if (hasErrors) return;
    setSaving(true);
    try {
      const chart = await saveSizeChart(productId, {
        enabled,
        chartType,
        unit,
        columns: columns.map((c) => ({ name: c.name })),
        rows: rows.map((r) => ({ size: r.size, values: r.values })),
      });
      // adopt the DB-assigned ids so future edits diff cleanly
      setColumns((chart.columns || []).map((c) => ({ id: `col_${c.id}`, name: c.name })));
      setRows(
        (chart.rows || []).map((r) => ({
          id: `row_${r.id}`,
          size: r.size,
          values: r.values || {},
        }))
      );
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
    } catch (err) {
      setSaveError(err.message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ backgroundColor: "#F1EEE7", fontFamily: "'Inter', sans-serif" }}
      className="min-h-full w-full p-4 sm:p-8"
    >
      <div className="mx-auto max-w-3xl">
        {/* breadcrumb / flow position */}
        <div className="mb-5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#8C8577]">
          {["Product Details", "Variants", "Size Chart", "Preview"].map((step, i) => (
            <React.Fragment key={step}>
              {i > 0 && <ChevronRight size={12} />}
              <span
                className={
                  step === "Size Chart"
                    ? "font-semibold text-[#7A2E2E]"
                    : "text-[#8C8577]"
                }
              >
                {step}
              </span>
            </React.Fragment>
          ))}
        </div>

        <div
          className="overflow-hidden rounded-md bg-white"
          style={{ border: "1px solid #DFDAD0" }}
        >
          {/* header strip — tape-measure ticks */}
          <div className="relative border-b" style={{ borderColor: "#DFDAD0" }}>
            <TickRule />
            <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-4">
              <div>
                <Eyebrow>Step 03</Eyebrow>
                <h2
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  className="text-[26px] font-semibold leading-tight text-[#1C1A17]"
                >
                  Size chart
                </h2>
                <p className="mt-0.5 text-[13px] text-[#6B6558]">
                  Help shoppers pick the right fit before they buy.
                </p>
              </div>
              <Toggle
                id="enable-size-chart"
                checked={enabled}
                onChange={setEnabled}
                label={enabled ? "Enabled" : "Disabled"}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-10 text-[13px] text-[#8C8577]">
              <Loader2 size={16} className="animate-spin" />
              Loading size chart…
            </div>
          ) : !enabled ? (
            <div className="px-6 py-10 text-center">
              <Ruler size={26} className="mx-auto mb-2 text-[#C7C0B1]" />
              <p className="text-[14px] text-[#8C8577]">
                No size chart will show on this product. Turn it on to add measurements.
              </p>
            </div>
          ) : (
            <div className="px-6 py-6">
              {/* info banner */}
              <div
                className="mb-6 flex items-start gap-2.5 rounded-md px-3.5 py-3"
                style={{ backgroundColor: "#FBF4E9", border: "1px solid #EBDAB8" }}
              >
                <Info size={15} className="mt-0.5 shrink-0 text-[#A9803D]" />
                <p className="text-[13px] leading-snug text-[#6B5A32]">
                  Provide accurate measurements to help customers select the correct
                  size and reduce size-related returns.
                </p>
              </div>

              {/* type + unit + presets */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#6B6558]">
                    Chart type
                  </label>
                  <div className="flex overflow-hidden rounded-md border" style={{ borderColor: "#DFDAD0" }}>
                    {["Standard", "Custom"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setChartType(t)}
                        className="flex-1 px-3 py-2 text-[13px] font-medium transition-colors"
                        style={{
                          backgroundColor: chartType === t ? "#7A2E2E" : "white",
                          color: chartType === t ? "white" : "#1C1A17",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#6B6558]">
                    Measurement unit
                  </label>
                  <div className="flex overflow-hidden rounded-md border" style={{ borderColor: "#DFDAD0" }}>
                    {[
                      { key: "in", label: "Inches" },
                      { key: "cm", label: "Centimeters" },
                    ].map((u) => (
                      <button
                        key={u.key}
                        type="button"
                        onClick={() => setUnit(u.key)}
                        className="flex-1 px-3 py-2 text-[13px] font-medium transition-colors"
                        style={{
                          backgroundColor: unit === u.key ? "#7A2E2E" : "white",
                          color: unit === u.key ? "white" : "#1C1A17",
                        }}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#6B6558]">
                  Quick-fill by category
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(CATEGORY_PRESETS).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => applyPreset(cat)}
                      className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium text-[#1C1A17] transition-colors hover:bg-[#F1EEE7]"
                      style={{ borderColor: "#DFDAD0" }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* variant sync note */}
              <div className="mb-5 flex items-center gap-2 text-[12.5px] text-[#6B6558]">
                <span className="font-semibold text-[#1C1A17]">Variant sizes:</span>
                {variantSizes.map((s) => (
                  <span
                    key={s}
                    className="rounded px-2 py-0.5 text-[12px] font-semibold"
                    style={{
                      backgroundColor: rows.some((r) => r.size === s)
                        ? "#EAF1EC"
                        : "#F7EAEA",
                      color: rows.some((r) => r.size === s) ? "#3F6C4B" : "#B23B3B",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
              {removedVariantWarning && (
                <div
                  className="mb-5 flex items-start gap-2 rounded-md px-3.5 py-2.5"
                  style={{ backgroundColor: "#FBEDED", border: "1px solid #EFC9C9" }}
                >
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-[#B23B3B]" />
                  <p className="text-[12.5px] leading-snug text-[#8A2E2E]">
                    {removedVariantWarning}
                  </p>
                </div>
              )}

              {/* table */}
              <div className="mb-3 flex items-center justify-between">
                <label className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6558]">
                  Measurements
                </label>
                {errors.general.length > 0 && touched && (
                  <span className="text-[12px] text-[#B23B3B]">{errors.general[0]}</span>
                )}
              </div>

              <div className="overflow-x-auto rounded-md border" style={{ borderColor: "#DFDAD0" }}>
                <table className="w-full min-w-[560px] border-collapse text-[13px]">
                  <thead>
                    <tr style={{ backgroundColor: "#F7F5F0" }}>
                      <th className="w-28 border-b px-3 py-2 text-left font-semibold text-[#1C1A17]" style={{ borderColor: "#DFDAD0" }}>
                        Size
                      </th>
                      {columns.map((c) => (
                        <th
                          key={c.id}
                          className="border-b px-3 py-2 text-left font-semibold text-[#1C1A17]"
                          style={{ borderColor: "#DFDAD0" }}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span>
                              {c.name}{" "}
                              <span className="font-normal text-[#8C8577]">({unit})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeColumn(c.id)}
                              className="text-[#B7B0A0] hover:text-[#B23B3B]"
                              aria-label={`Remove ${c.name} column`}
                            >
                              <X size={13} />
                            </button>
                          </div>
                          {errors.columns[c.id] && (
                            <div className="mt-0.5 text-[11px] font-normal text-[#B23B3B]">
                              {errors.columns[c.id]}
                            </div>
                          )}
                        </th>
                      ))}
                      <th className="w-10 border-b px-2 py-2" style={{ borderColor: "#DFDAD0" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const rowErr = errors.rows[r.id];
                      return (
                        <tr key={r.id} style={{ backgroundColor: idx % 2 ? "#FCFBF9" : "white" }}>
                          <td className="border-b px-2 py-1.5 align-top" style={{ borderColor: "#EFEBE3" }}>
                            <input
                              value={r.size}
                              onChange={(e) => updateRowSize(r.id, e.target.value)}
                              placeholder="e.g. M"
                              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                              className="w-full rounded border bg-transparent px-2 py-1 text-[13px] font-medium text-[#1C1A17] focus:border-[#7A2E2E] focus:outline-none"
                            />
                            {touched && rowErr?.size && <FieldError>{rowErr.size}</FieldError>}
                          </td>
                          {columns.map((c) => (
                            <td
                              key={c.id}
                              className="border-b px-2 py-1.5 align-top"
                              style={{ borderColor: "#EFEBE3" }}
                            >
                              <input
                                inputMode="decimal"
                                value={r.values[c.name] ?? ""}
                                onChange={(e) => updateCell(r.id, c.name, e.target.value)}
                                placeholder="0"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                className="w-20 rounded border bg-transparent px-2 py-1 text-[13px] text-[#1C1A17] focus:border-[#7A2E2E] focus:outline-none"
                              />
                              {touched && rowErr?.values?.[c.name] && (
                                <FieldError>{rowErr.values[c.name]}</FieldError>
                              )}
                            </td>
                          ))}
                          <td className="border-b px-2 py-1.5 text-center align-top" style={{ borderColor: "#EFEBE3" }}>
                            <button
                              type="button"
                              onClick={() => removeRow(r.id)}
                              className="mt-1 text-[#B7B0A0] hover:text-[#B23B3B]"
                              aria-label={`Delete ${r.size} row`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={columns.length + 2}
                          className="px-3 py-6 text-center text-[13px] text-[#8C8577]"
                        >
                          No sizes yet — add one below.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* add row / add column controls */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#6B6558]">
                    Add size
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {STANDARD_SIZES.filter(
                      (s) => !rows.some((r) => r.size.toLowerCase() === s.toLowerCase())
                    ).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => addRow(s)}
                        className="rounded border px-2.5 py-1 text-[12.5px] font-medium text-[#1C1A17] hover:bg-[#F1EEE7]"
                        style={{ borderColor: "#DFDAD0" }}
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={newSizeName}
                      onChange={(e) => setNewSizeName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addRow()}
                      placeholder="Custom size name"
                      className="flex-1 rounded border px-2.5 py-1.5 text-[13px] focus:border-[#7A2E2E] focus:outline-none"
                      style={{ borderColor: "#DFDAD0" }}
                    />
                    <button
                      type="button"
                      onClick={() => addRow()}
                      className="flex items-center gap-1 rounded px-3 py-1.5 text-[12.5px] font-semibold text-white"
                      style={{ backgroundColor: "#7A2E2E" }}
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#6B6558]">
                    Add measurement column
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addColumn(newColumnName)}
                      placeholder="e.g. Sleeve Length"
                      className="flex-1 rounded border px-2.5 py-1.5 text-[13px] focus:border-[#7A2E2E] focus:outline-none"
                      style={{ borderColor: "#DFDAD0" }}
                    />
                    <button
                      type="button"
                      onClick={() => addColumn(newColumnName)}
                      className="flex items-center gap-1 rounded px-3 py-1.5 text-[12.5px] font-semibold text-white"
                      style={{ backgroundColor: "#7A2E2E" }}
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-[#8C8577]">
                    Columns aren't fixed — configure them per category (Chest, Waist,
                    Inseam, EU Size…).
                  </p>
                </div>
              </div>

              {/* image upload */}
              <div className="mt-7 border-t pt-6" style={{ borderColor: "#EFEBE3" }}>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#6B6558]">
                  Size chart image <span className="font-normal normal-case text-[#8C8577]">(optional)</span>
                </label>
                {!image ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-[13px] text-[#6B6558] hover:bg-[#FBF9F5]"
                    style={{ borderColor: "#C7C0B1" }}
                  >
                    <Upload size={15} />
                    Upload JPG, PNG, or WEBP — up to 5 MB
                  </button>
                ) : (
                  <div className="flex items-center gap-3 rounded-md border p-2.5" style={{ borderColor: "#DFDAD0" }}>
                    <img
                      src={image.dataUrl}
                      alt="Size chart preview"
                      className="h-16 w-16 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[#1C1A17]">{image.name}</p>
                      <p className="text-[11.5px] text-[#8C8577]">
                        {imageUploading
                          ? "Uploading…"
                          : `${(image.size / 1024).toFixed(0)} KB`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded px-2.5 py-1 text-[12px] font-medium text-[#1C1A17] hover:bg-[#F1EEE7]"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="rounded px-2.5 py-1 text-[12px] font-medium text-[#B23B3B] hover:bg-[#FBEDED]"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                />
                <FieldError>{imageError}</FieldError>
              </div>
            </div>
          )}

          {/* footer actions */}
          <div
            className="flex items-center justify-between border-t px-6 py-4"
            style={{ borderColor: "#DFDAD0", backgroundColor: "#FBFAF7" }}
          >
            <button
              type="button"
              disabled={!enabled}
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:text-[#C7C0B1]"
              style={{ color: enabled ? "#7A2E2E" : undefined }}
            >
              <Eye size={15} /> Preview size chart
            </button>
            <div className="flex items-center gap-3">
              {saveError && (
                <span className="flex items-center gap-1 text-[13px] font-medium text-[#B23B3B]">
                  <AlertCircle size={14} /> {saveError}
                </span>
              )}
              {savedFlash && (
                <span className="flex items-center gap-1 text-[13px] font-medium text-[#3F6C4B]">
                  <Check size={14} /> Saved
                </span>
              )}
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-[13px] font-semibold text-[#1C1A17] hover:bg-[#F1EEE7]"
                style={{ borderColor: "#DFDAD0" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#7A2E2E" }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Saving…" : "Save product"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPreview && (
        <PreviewModal
          onClose={() => setShowPreview(false)}
          unit={unit}
          columns={columns}
          rows={rows}
          image={image}
        />
      )}
    </div>
  );
}

function TickRule() {
  const ticks = Array.from({ length: 40 });
  return (
    <div className="flex h-2 w-full overflow-hidden" style={{ backgroundColor: "#7A2E2E" }}>
      {ticks.map((_, i) => (
        <div
          key={i}
          className="flex-1 border-r"
          style={{
            borderColor: "rgba(255,255,255,0.25)",
            height: i % 5 === 0 ? "100%" : "55%",
          }}
        />
      ))}
    </div>
  );
}

function PreviewModal({ onClose, unit, columns, rows, image }) {
  const unitLabel = unit === "in" ? "in" : "cm";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(28,26,23,0.5)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-md bg-white"
        style={{ border: "1px solid #DFDAD0" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#DFDAD0" }}>
          <h3
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            className="text-[20px] font-semibold text-[#1C1A17]"
          >
            Size chart
          </h3>
          <button onClick={onClose} className="text-[#8C8577] hover:text-[#1C1A17]" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5">
          <p className="mb-3 text-[12.5px] text-[#8C8577]">
            Measurements shown in {unit === "in" ? "inches" : "centimeters"}.
          </p>
          <div className="overflow-x-auto rounded-md border" style={{ borderColor: "#DFDAD0" }}>
            <table className="w-full min-w-[420px] border-collapse text-[13px]">
              <thead>
                <tr style={{ backgroundColor: "#F7F5F0" }}>
                  <th className="border-b px-3 py-2 text-left font-semibold" style={{ borderColor: "#DFDAD0" }}>
                    Size
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c.id}
                      className="border-b px-3 py-2 text-left font-semibold"
                      style={{ borderColor: "#DFDAD0" }}
                    >
                      {c.name} <span className="font-normal text-[#8C8577]">({unitLabel})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} style={{ backgroundColor: idx % 2 ? "#FCFBF9" : "white" }}>
                    <td
                      style={{ fontFamily: "'IBM Plex Mono', monospace", borderColor: "#EFEBE3" }}
                      className="border-b px-3 py-1.5 font-semibold"
                    >
                      {r.size}
                    </td>
                    {columns.map((c) => (
                      <td
                        key={c.id}
                        style={{ fontFamily: "'IBM Plex Mono', monospace", borderColor: "#EFEBE3" }}
                        className="border-b px-3 py-1.5"
                      >
                        {r.values[c.name] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {image && (
            <div className="mt-4">
              <img src={image.dataUrl} alt="Size chart" className="w-full rounded-md" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
