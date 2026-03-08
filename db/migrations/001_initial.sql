CREATE TABLE IF NOT EXISTS source_files (
    file_id      TEXT PRIMARY KEY,
    file_path    TEXT NOT NULL,
    file_name    TEXT NOT NULL,
    file_type    TEXT NOT NULL CHECK (file_type IN ('xlsx','xls','mdb','accdb')),
    file_hash    TEXT NOT NULL,
    imported_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    notes        TEXT
);

CREATE TABLE IF NOT EXISTS datasets (
    dataset_id     TEXT PRIMARY KEY,
    file_id        TEXT NOT NULL REFERENCES source_files(file_id) ON DELETE CASCADE,
    sheet_or_table TEXT NOT NULL,
    display_name   TEXT NOT NULL,
    row_count      INTEGER NOT NULL DEFAULT 0,
    col_count      INTEGER NOT NULL DEFAULT 0,
    parsed_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS dataset_columns (
    column_id    TEXT PRIMARY KEY,
    dataset_id   TEXT NOT NULL REFERENCES datasets(dataset_id) ON DELETE CASCADE,
    col_index    INTEGER NOT NULL,
    col_name     TEXT NOT NULL,
    display_name TEXT NOT NULL,
    data_type    TEXT NOT NULL CHECK (data_type IN ('number','string','datetime','boolean')),
    unit         TEXT,
    sample_min   REAL,
    sample_max   REAL,
    sample_mean  REAL,
    UNIQUE(dataset_id, col_index)
);

CREATE TABLE IF NOT EXISTS chart_configs (
    config_id    TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    chart_type   TEXT NOT NULL CHECK (chart_type IN ('line','scatter','bar','histogram','area','box')),
    config_json  TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS export_presets (
    preset_id      TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    export_type    TEXT NOT NULL CHECK (export_type IN ('xlsx','mdb')),
    source_config  TEXT NOT NULL,
    output_path    TEXT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS dashboards (
    dashboard_id TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    layout_json  TEXT NOT NULL DEFAULT '[]',
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS vm_models (
    model_id         TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    model_type       TEXT NOT NULL,
    target_column_id TEXT NOT NULL,
    dataset_id       TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'draft',
    model_file_path  TEXT,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
