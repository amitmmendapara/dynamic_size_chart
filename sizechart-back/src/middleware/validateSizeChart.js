// Mirrors the validation already implemented client-side in
// SizeChartSection.jsx (`errors` useMemo), so a request can never
// persist data the UI itself would have blocked.
//
// Expected body shape:
// {
//   enabled: boolean,
//   chartType: "Standard" | "Custom",
//   unit: "in" | "cm",
//   columns: [{ name: string }],
//   rows: [{ size: string, values: { [columnName]: string|number } }]
// }

function validateSizeChart(req, res, next) {
  const body = req.body || {};
  const errors = { general: [], columns: {}, rows: {} };

  const enabled = body.enabled !== false; // default true, same as UI default
  const columns = Array.isArray(body.columns) ? body.columns : [];
  const rows = Array.isArray(body.rows) ? body.rows : [];

  if (body.chartType && !["Standard", "Custom"].includes(body.chartType)) {
    errors.general.push("chartType must be 'Standard' or 'Custom'.");
  }
  if (body.unit && !["in", "cm"].includes(body.unit)) {
    errors.general.push("unit must be 'in' or 'cm'.");
  }

  if (enabled) {
    if (rows.length === 0) {
      errors.general.push("Add at least one size before saving.");
    }

    // duplicate / empty column names
    const seenCols = new Map();
    columns.forEach((c, i) => {
      const name = (c?.name ?? "").trim();
      if (!name) {
        errors.columns[i] = "Column name is required.";
        return;
      }
      const key = name.toLowerCase();
      if (seenCols.has(key)) {
        errors.columns[i] = "Duplicate column.";
      }
      seenCols.set(key, true);
    });

    // duplicate / empty size names, numeric + non-negative cell values
    const seenSizes = new Map();
    rows.forEach((r, i) => {
      const rowErr = { size: "", values: {} };
      const size = (r?.size ?? "").trim();
      if (!size) {
        rowErr.size = "Size name is required.";
      } else {
        const key = size.toLowerCase();
        if (seenSizes.has(key)) rowErr.size = "Duplicate size name.";
        seenSizes.set(key, true);
      }

      const values = r?.values || {};
      Object.entries(values).forEach(([colName, v]) => {
        if (v === undefined || v === null || v === "") return;
        if (isNaN(Number(v))) {
          rowErr.values[colName] = "Numbers only.";
        } else if (Number(v) < 0) {
          rowErr.values[colName] = "Cannot be negative.";
        }
      });

      if (rowErr.size || Object.keys(rowErr.values).length) {
        errors.rows[i] = rowErr;
      }
    });
  }

  const hasErrors =
    errors.general.length > 0 ||
    Object.keys(errors.columns).length > 0 ||
    Object.keys(errors.rows).length > 0;

  if (hasErrors) {
    return res.status(422).json({ message: "Validation failed", errors });
  }

  next();
}

module.exports = validateSizeChart;
