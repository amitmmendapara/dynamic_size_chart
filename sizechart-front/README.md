# Size Chart Frontend

React + Vite + Tailwind app built around your `SizeChartSection.jsx`,
wired up to the `sizechart-backend` API (GET/save the chart, upload/remove
the reference image).

## Setup

```bash
npm install
cp .env.example .env      # points at the backend, defaults to :4000
npm run dev                # http://localhost:5173
```

Make sure `sizechart-backend` is running first (`npm run dev` in that
project) and that at least one product row exists — `App.jsx` currently
points at `PRODUCT_ID = 1`:

```sql
INSERT INTO products (name) VALUES ('Classic Tee') RETURNING id;
```

## What was wired up vs. the original component

The visual design, table, presets, and validation are untouched — only
the data layer changed:

- **`src/api/sizeChartApi.js`** — thin `fetch` wrapper for the backend's
  5 endpoints (`get`, `save`, `uploadImage`, `deleteImage`, `resolveImageUrl`).
- **On mount**, the component now fetches the saved chart for `productId`
  and populates settings/columns/rows/image from the database instead of
  the hardcoded `DEFAULT_COLUMNS` / `DEFAULT_ROWS` demo data.
- **Image upload** now POSTs the file to the backend immediately (with an
  instant local preview while it's in flight) instead of only keeping a
  base64 data URL in memory; **Remove** calls the delete endpoint.
- **Save product** now does a real `PUT` and shows `Saving…` / an error
  banner if the request fails, instead of only flashing a local "Saved" state.

Everything else — add/remove rows and columns, category presets, client-side
validation, the preview modal — is exactly what you uploaded.

## Structure

```
src/
  api/sizeChartApi.js       API client
  components/SizeChartSection.jsx   your component, now API-backed
  App.jsx                   mounts it with a productId
  main.jsx, index.css       Vite/Tailwind entry points
```
