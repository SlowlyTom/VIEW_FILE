# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```powershell
# Development (launches Electron window with hot reload)
cd D:/Claude/ViewList
npm run dev

# Build output only (no Electron launch)
npm run build

# Recompile better-sqlite3 native addon against Electron's Node headers
npm run rebuild
```

To package as a distributable EXE, install `electron-builder` and add a `dist` script — not yet configured.

## Architecture

This is an **Electron + React + TypeScript** desktop app using `electron-vite` as the build tool. There are three isolated processes:

### Main Process (`src/main/`)
- `index.ts` — app lifecycle, window creation, registers all IPC handlers
- `db.ts` — initializes `better-sqlite3` at `%APPDATA%/viewlist/viewlist.db`. Uses `createRequire(import.meta.url)` to load the native addon (bypasses Rollup bundling). Migration SQL is inlined as a fallback so the app works without the external `.sql` file.
- `ipc/fileHandlers.ts` — parses Excel via `exceljs`, MDB/ACCDB via `node-adodb` (Windows ODBC). Infers column types, computes stats, saves metadata to SQLite. Returns full row data to renderer.
- `ipc/dbHandlers.ts` — CRUD for files, datasets, columns, dashboards
- `ipc/chartHandlers.ts` — save/load/delete chart configs (stored as JSON blob in SQLite)
- `ipc/exportHandlers.ts` — Excel export via `exceljs` write API; MDB export via ADODB `CREATE TABLE` + `INSERT`

### Preload (`src/preload/index.ts`)
Exposes `window.api` via `contextBridge`. All IPC calls go through this bridge. The renderer-side type definition is in `src/renderer/src/api.ts` (separate from preload to avoid cross-process TypeScript imports).

### Renderer (`src/renderer/src/`)
React SPA with a tab layout: **Data | Chart | Dashboard | Export**

**State management (Zustand):**
- `store/fileStore.ts` — open files list, selected file/dataset IDs
- `store/dataStore.ts` — `Map<datasetId, RowData[]>` holding all parsed rows in memory (re-parsed from source file on app restart)

**Data flow:** File opened → main process parses → rows returned via IPC → stored in `dataStore` → components read from store. SQLite only stores metadata (file info, column types, chart configs), not row data.

**Multi-file chart join (`hooks/useCharts.ts`):**
- `index` mode: aligns rows by position (shorter dataset truncates)
- `key` mode: joins on a shared column value (datetime or ID)

### Key Technical Constraints
- `better-sqlite3` must stay external to Rollup — configured in `electron-vite.config.ts` via `externalizeDepsPlugin()` plus explicit `rollupOptions.external`
- `node-adodb` requires Windows with `Microsoft.Jet.OLEDB.4.0` (MDB) or `Microsoft.ACE.OLEDB.12.0` (ACCDB) ODBC drivers. 32-bit vs 64-bit driver mismatch is a common failure point.
- After `npm install`, run `npm run rebuild` if `better-sqlite3` crashes (native addon must be compiled against Electron's embedded Node version, not system Node)

## SQLite Schema (metadata only)
- `source_files` → `datasets` → `dataset_columns` (cascade delete)
- `chart_configs` — full chart config as `config_json` blob (includes xAxis, series array with per-series datasetId+columnId, joinMode)
- `dashboards` — layout as JSON array of `{configId, x, y, w, h}`
