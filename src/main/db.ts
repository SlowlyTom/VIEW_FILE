import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { createRequire } from 'module'

// Use createRequire to load better-sqlite3 as CJS — avoids Rollup bundling the native addon
const _require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Database = _require('better-sqlite3') as typeof import('better-sqlite3').default
type DatabaseInstance = ReturnType<typeof Database>

let db: DatabaseInstance

export function getDb(): DatabaseInstance {
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'viewlist.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Resolve migration file path — works in both dev and production
  const migrationCandidates = [
    // Production: resources directory
    join(process.resourcesPath ?? '', 'db', 'migrations', '001_initial.sql'),
    // Dev: project root relative to app path
    join(app.getAppPath(), 'db', 'migrations', '001_initial.sql'),
    // Fallback: relative to __dirname (main process output)
    join(__dirname, '..', '..', 'db', 'migrations', '001_initial.sql'),
  ]

  // Inline migration SQL as final fallback
  const inlineMigrationSql = `
    CREATE TABLE IF NOT EXISTS source_files (
      file_id TEXT PRIMARY KEY, file_path TEXT NOT NULL, file_name TEXT NOT NULL,
      file_type TEXT NOT NULL, file_hash TEXT NOT NULL,
      imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), notes TEXT
    );
    CREATE TABLE IF NOT EXISTS datasets (
      dataset_id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES source_files(file_id) ON DELETE CASCADE,
      sheet_or_table TEXT NOT NULL, display_name TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0, col_count INTEGER NOT NULL DEFAULT 0,
      parsed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS dataset_columns (
      column_id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id) ON DELETE CASCADE,
      col_index INTEGER NOT NULL, col_name TEXT NOT NULL, display_name TEXT NOT NULL,
      data_type TEXT NOT NULL, unit TEXT, sample_min REAL, sample_max REAL, sample_mean REAL,
      UNIQUE(dataset_id, col_index)
    );
    CREATE TABLE IF NOT EXISTS chart_configs (
      config_id TEXT PRIMARY KEY, name TEXT NOT NULL, chart_type TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS dashboards (
      dashboard_id TEXT PRIMARY KEY, name TEXT NOT NULL,
      layout_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `

  let migrationSql: string = inlineMigrationSql
  for (const candidate of migrationCandidates) {
    if (existsSync(candidate)) {
      const { readFileSync } = _require('fs') as typeof import('fs')
      migrationSql = readFileSync(candidate, 'utf-8')
      break
    }
  }

  db.exec(migrationSql)
}
