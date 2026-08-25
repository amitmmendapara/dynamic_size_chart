const pool = require("../config/db");

const CHART_TYPE_DB = { Standard: "standard", Custom: "custom" };
const CHART_TYPE_API = { standard: "Standard", custom: "Custom" };

// One query, JSON-aggregated, returns exactly the shape the frontend
// (columns[], rows[{size, values:{colName: value}}]) already works with.
const SELECT_CHART_SQL = `
  SELECT
    sc.id,
    sc.enabled,
    sc.chart_type,
    sc.unit,
    sc.image_url,
    sc.updated_at,
    COALESCE(cols.columns, '[]'::json)  AS columns,
    COALESCE(rws.rows, '[]'::json)      AS rows
  FROM size_charts sc
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.id) AS columns
    FROM size_chart_columns c
    WHERE c.size_chart_id = sc.id
  ) cols ON true
  LEFT JOIN LATERAL (
    SELECT json_agg(
             json_build_object(
               'id', r.id,
               'size', r.size_label,
               'values', (
                 SELECT COALESCE(jsonb_object_agg(col.name, v.value), '{}'::jsonb)
                 FROM size_chart_values v
                 JOIN size_chart_columns col ON col.id = v.column_id
                 WHERE v.row_id = r.id
               )
             )
             ORDER BY r.id
           ) AS rows
    FROM size_chart_rows r
    WHERE r.size_chart_id = sc.id
  ) rws ON true
  WHERE sc.product_id = $1;
`;

function toApiShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    enabled: row.enabled,
    chartType: CHART_TYPE_API[row.chart_type] || row.chart_type,
    unit: row.unit,
    image: row.image_url
      ? { url: row.image_url, name: row.image_name, size: row.image_size_bytes }
      : null,
    columns: row.columns || [],
    rows: row.rows || [],
    updatedAt: row.updated_at,
  };
}

async function getByProductId(productId) {
    console.log("productId:", productId);
    console.log("productId type:", typeof productId);
  
  const { rows } = await pool.query(SELECT_CHART_SQL, [productId]);
  return toApiShape(rows[0]);
}

/**
 * Full replace-save of a size chart's settings/columns/rows/values,
 * matching the "Save product" button which submits the whole form
 * state at once. Runs in a transaction: delete-and-reinsert columns
 * and rows (values cascade), so the DB always matches what was sent.
 */

async function upsertSizeChart(productId, payload) {
  const { vendorId, enabled, chartType, unit, columns = [], rows = [] } = payload;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const productExists = await client.query(
      "SELECT id, vendor_id FROM products WHERE id = $1",
      [productId]
    );
    if (productExists.rowCount === 0) {
      const err = new Error("Product not found");
      err.status = 404;
      throw err;
    }
    const vendorId = productExists.rows[0].vendor_id;
    //const productId = '333333-3333-3333-3333-333333333333'

    const chartRes = await client.query(
      `INSERT INTO size_charts
          (product_id, vendor_id, enabled, chart_type, unit)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (product_id) DO UPDATE SET
          enabled = EXCLUDED.enabled,
          chart_type = EXCLUDED.chart_type,
          unit = EXCLUDED.unit
       RETURNING id`,
      [
        productId,
        vendorId,
        enabled !== false,
        CHART_TYPE_DB[chartType] || "standard",
        unit || "in"
      ]
    );

    // const chartRes = await client.query(
    //   `INSERT INTO size_charts (product_id, enabled, chart_type, unit)
    //    VALUES ($1, $2, $3, $4)
    //    ON CONFLICT (product_id) DO UPDATE SET
    //      enabled = EXCLUDED.enabled,
    //      chart_type = EXCLUDED.chart_type,
    //      unit = EXCLUDED.unit
    //    RETURNING id`,
    //   [productId, enabled !== false, CHART_TYPE_DB[chartType] || "standard", unit || "in"]
    // );
    const chartId = chartRes.rows[0].id;

    // Wipe existing columns/rows for this chart; values cascade with them.
    await client.query("DELETE FROM size_chart_columns WHERE size_chart_id = $1", [chartId]);
    await client.query("DELETE FROM size_chart_rows WHERE size_chart_id = $1", [chartId]);

    const columnIdByName = {};
    for (let i = 0; i < columns.length; i++) {
      const name = String(columns[i].name).trim();
    
      const { rows: colRows } = await client.query(
        `INSERT INTO size_chart_columns
           (size_chart_id, name, position)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [chartId, name, i]
      );
    
      columnIdByName[name.toLowerCase()] = colRows[0].id;
    }
    
    for (let i = 0; i < rows.length; i++) {
      const size = String(rows[i].size).trim();
    
      const { rows: rowRows } = await client.query(
        `INSERT INTO size_chart_rows
           (size_chart_id, size_label, position)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [chartId, size, i]
      );
    
      const rowId = rowRows[0].id;
    
      const values = rows[i].values || {};
    
      for (const [colName, rawValue] of Object.entries(values)) {
        if (
          rawValue === "" ||
          rawValue === undefined ||
          rawValue === null
        ) {
          continue;
        }
    
        const columnId =
          columnIdByName[String(colName).trim().toLowerCase()];
    
        if (!columnId) continue;
    
         
      }
    }

    await client.query("COMMIT");
    return getByProductId(productId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function setImage(productId, image) {
  // Ensure a size_charts row exists even if settings haven't been saved yet.
  await pool.query(
    `INSERT INTO size_charts (product_id) VALUES ($1)
     ON CONFLICT (product_id) DO NOTHING`,
    [productId]
  );
  await pool.query(
    `UPDATE size_charts
     SET image_url = $2, image_name = $3, image_size_bytes = $4
     WHERE product_id = $1`,
    [productId, image.url, image.name, image.size]
  );
  return getByProductId(productId);
}

async function clearImage(productId) {
  await pool.query(
    `UPDATE size_charts
     SET image_url = NULL, image_name = NULL, image_size_bytes = NULL
     WHERE product_id = $1`,
    [productId]
  );
  return getByProductId(productId);
}

async function getPresets() {
  const { rows } = await pool.query(
    "SELECT category, columns FROM size_chart_category_presets ORDER BY category"
  );
  return rows;
}

module.exports = {
  getByProductId,
  upsertSizeChart,
  setImage,
  clearImage,
  getPresets,
};
