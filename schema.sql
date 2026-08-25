-- =====================================================================
-- Size Chart — PostgreSQL schema
-- Normalized design: a size chart belongs to a product, has a flexible
-- set of columns (Chest, Waist, EU Size...) and rows (XS, S, M, 32...),
-- with the actual measurements stored in a junction table so columns
-- and rows can be added/removed freely, per category, per product.
-- =====================================================================

CREATE TYPE chart_type AS ENUM ('standard', 'custom');
CREATE TYPE measurement_unit AS ENUM ('in', 'cm');

-- ---------------------------------------------------------------------
-- products (minimal — extend with your real product table/fields)
-- ---------------------------------------------------------------------
CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- size_charts — one per product (1:1). Holds the top-level settings
-- (enabled toggle, Standard/Custom, unit, optional reference image).
-- ---------------------------------------------------------------------
CREATE TABLE size_charts (
    id                  BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL UNIQUE
                            REFERENCES products(id) ON DELETE CASCADE,
    enabled             BOOLEAN NOT NULL DEFAULT true,
    chart_type          chart_type NOT NULL DEFAULT 'standard',
    unit                measurement_unit NOT NULL DEFAULT 'in',
    image_url           TEXT,
    image_name          TEXT,
    image_size_bytes    INTEGER CHECK (image_size_bytes IS NULL OR image_size_bytes <= 5242880), -- 5 MB
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- size_chart_columns — the measurement columns (Chest, Waist, Inseam...)
-- `position` preserves the on-screen column order.
-- ---------------------------------------------------------------------
CREATE TABLE size_chart_columns (
    id              BIGSERIAL PRIMARY KEY,
    size_chart_id   BIGINT NOT NULL
                        REFERENCES size_charts(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    position        SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- case-insensitive uniqueness per chart, mirrors the frontend's
-- "Duplicate column" validation
CREATE UNIQUE INDEX uq_size_chart_columns_name
    ON size_chart_columns (size_chart_id, LOWER(name));
CREATE INDEX idx_size_chart_columns_chart ON size_chart_columns(size_chart_id);

-- ---------------------------------------------------------------------
-- size_chart_rows — the size rows (XS, S, M, 32, 34...)
-- ---------------------------------------------------------------------
CREATE TABLE size_chart_rows (
    id              BIGSERIAL PRIMARY KEY,
    size_chart_id   BIGINT NOT NULL
                        REFERENCES size_charts(id) ON DELETE CASCADE,
    size_label      TEXT NOT NULL,
    position        SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- case-insensitive uniqueness per chart, mirrors "Duplicate size name"
CREATE UNIQUE INDEX uq_size_chart_rows_label
    ON size_chart_rows (size_chart_id, LOWER(size_label));
CREATE INDEX idx_size_chart_rows_chart ON size_chart_rows(size_chart_id);

-- ---------------------------------------------------------------------
-- size_chart_values — the actual measurement cells (row x column).
-- Sparse by design: a cell only exists if the user filled it in,
-- matching the frontend's "—" placeholder for empty cells.
-- ---------------------------------------------------------------------
CREATE TABLE size_chart_values (
    id          BIGSERIAL PRIMARY KEY,
    row_id      BIGINT NOT NULL
                    REFERENCES size_chart_rows(id) ON DELETE CASCADE,
    column_id   BIGINT NOT NULL
                    REFERENCES size_chart_columns(id) ON DELETE CASCADE,
    value       NUMERIC(6,2) CHECK (value IS NULL OR value >= 0), -- "Numbers only" / "Cannot be negative"
    UNIQUE (row_id, column_id)
);
CREATE INDEX idx_size_chart_values_row    ON size_chart_values(row_id);
CREATE INDEX idx_size_chart_values_column ON size_chart_values(column_id);

-- ---------------------------------------------------------------------
-- keep updated_at fresh
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_size_charts_updated_at
    BEFORE UPDATE ON size_charts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- seed: category presets referenced by the "Apply preset" buttons
-- (kept as a lookup table so new presets don't require a code deploy)
-- ---------------------------------------------------------------------
CREATE TABLE size_chart_category_presets (
    id          BIGSERIAL PRIMARY KEY,
    category    TEXT NOT NULL UNIQUE,
    columns     TEXT[] NOT NULL
);

INSERT INTO size_chart_category_presets (category, columns) VALUES
    ('T-Shirts', ARRAY['Chest', 'Length', 'Shoulder']),
    ('Jeans',    ARRAY['Waist', 'Hip', 'Inseam', 'Length']),
    ('Shoes',    ARRAY['UK Size', 'US Size', 'EU Size', 'Foot Length']);
