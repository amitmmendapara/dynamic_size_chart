# Size Chart Backend

Node.js + Express + PostgreSQL backend for the Size Chart builder UI
(`SizeChartSection.jsx`). Plain `pg` (node-postgres) is used — no ORM —
so the SQL in `sql/schema.sql` is exactly what runs against your DB.

## Setup

```bash
npm install
cp .env.example .env      # then edit DB credentials
createdb sizechart_db     # or create it however you normally do
npm run db:migrate        # applies sql/schema.sql
npm run dev                # starts on http://localhost:4000
```

Create at least one product row to attach a chart to:

```sql
INSERT INTO products (name) VALUES ('Classic Tee') RETURNING id;
```

## API

| Method | Path                                     | Purpose                                   |
|--------|-------------------------------------------|--------------------------------------------|
| GET    | `/api/size-chart-presets`                 | Category presets (T-Shirts/Jeans/Shoes)    |
| GET    | `/api/products/:productId/size-chart`     | Fetch a product's chart                    |
| PUT    | `/api/products/:productId/size-chart`     | Full save (settings + columns + rows)      |
| POST   | `/api/products/:productId/size-chart/image` | Upload reference image (`multipart/form-data`, field `image`) |
| DELETE | `/api/products/:productId/size-chart/image` | Remove the reference image               |

### `PUT /api/products/:productId/size-chart` body

```json
{
  "enabled": true,
  "chartType": "Standard",
  "unit": "in",
  "columns": [{ "name": "Chest" }, { "name": "Waist" }],
  "rows": [
    { "size": "S", "values": { "Chest": "36", "Waist": "30" } },
    { "size": "M", "values": { "Chest": "38", "Waist": "32" } }
  ]
}
```

Validation matches the frontend exactly (required + duplicate size/column
names, numeric-only and non-negative cell values, at least one row when
enabled) and returns `422` with a matching `errors` shape on failure.

### Response shape (GET / PUT / image endpoints)

```json
{
  "id": 1,
  "enabled": true,
  "chartType": "Standard",
  "unit": "in",
  "image": { "url": "/uploads/172...-tee.jpg", "name": "tee.jpg", "size": 84213 },
  "columns": [{ "id": 5, "name": "Chest" }],
  "rows": [{ "id": 11, "size": "S", "values": { "Chest": "36" } }]
}
```

## Schema design notes

* `size_charts` is 1:1 with `products` (`product_id UNIQUE`).
* Columns and rows are separate tables so a chart's shape is completely
  flexible per product/category — no fixed "Chest/Waist/Hip/Length" columns.
* `size_chart_values` is the row × column junction table holding the actual
  numbers; it's intentionally sparse (a cell only exists if filled in).
* Case-insensitive unique indexes on `(chart, name)` / `(chart, size_label)`
  enforce "no duplicate column" / "no duplicate size" at the DB level, on
  top of the app-level check.
* A full **save** (`PUT .../size-chart`) deletes and re-inserts that chart's
  columns/rows/values inside one transaction — simplest correct approach
  for a form that always submits its entire state at once. Swap for a
  diff-based upsert later if partial/concurrent edits become a requirement.
* The reference image is handled as its own small resource
  (upload/replace/remove), matching the UI, and is stored on local disk via
  `multer` — swap `middleware/upload.js` for an S3/GCS adapter for production.
