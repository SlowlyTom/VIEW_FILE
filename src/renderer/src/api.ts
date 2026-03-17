// API type definition that mirrors the preload contextBridge exposure.
// This file is renderer-only — it does NOT import from the main/preload process.

export interface ViewListAPI {
  openFileDialog: () => Promise<Electron.OpenDialogReturnValue>
  parseFile: (filePath: string) => Promise<{
    success: boolean
    fileId?: string
    datasets?: ParsedDataset[]
    error?: string
  }>
  reparseFile: (
    fileId: string,
    filePath: string
  ) => Promise<{
    success: boolean
    datasets?: { datasetId: string; rows: Record<string, unknown>[] }[]
    error?: string
  }>
  getFiles: () => Promise<SourceFileRow[]>
  deleteFile: (fileId: string) => Promise<{ success: boolean }>

  getDatasets: (fileId: string) => Promise<DatasetRow[]>
  getColumns: (datasetId: string) => Promise<ColumnRow[]>

  saveChart: (config: unknown) => Promise<{ success: boolean; config_id?: string }>
  getCharts: () => Promise<ChartConfigRow[]>
  deleteChart: (configId: string) => Promise<{ success: boolean }>

  exportExcel: (config: unknown) => Promise<{ success: boolean; error?: string }>
  exportMdb: (config: unknown) => Promise<{ success: boolean; error?: string }>
  saveFileDialog: (
    defaultPath?: string,
    filters?: { name: string; extensions: string[] }[]
  ) => Promise<Electron.SaveDialogReturnValue>

  saveDashboard: (dashboard: unknown) => Promise<{ success: boolean; dashboard_id?: string }>
  getDashboards: () => Promise<DashboardRow[]>
}

export interface SourceFileRow {
  file_id: string
  file_path: string
  file_name: string
  file_type: 'xlsx' | 'xls' | 'mdb' | 'accdb'
  file_hash: string
  imported_at: string
  notes?: string
}

export interface DatasetRow {
  dataset_id: string
  file_id: string
  sheet_or_table: string
  display_name: string
  row_count: number
  col_count: number
  parsed_at: string
}

export interface ColumnRow {
  column_id: string
  dataset_id: string
  col_index: number
  col_name: string
  display_name: string
  data_type: 'number' | 'string' | 'datetime' | 'boolean'
  unit?: string
  sample_min?: number
  sample_max?: number
  sample_mean?: number
}

export interface ChartConfigRow {
  config_id: string
  name: string
  chart_type: 'line' | 'scatter' | 'bar' | 'histogram' | 'area' | 'box'
  config_json: string
  created_at: string
  updated_at: string
}

export interface DashboardRow {
  dashboard_id: string
  name: string
  layout_json: string
  created_at: string
}

export interface ParsedDataset {
  datasetId: string
  fileId: string
  sheetOrTable: string
  displayName: string
  rowCount: number
  colCount: number
  columns: ParsedColumn[]
  rows: Record<string, unknown>[]
}

export interface ParsedColumn {
  columnId: string
  colIndex: number
  colName: string
  displayName: string
  dataType: 'number' | 'string' | 'datetime' | 'boolean'
  sampleMin: number | null
  sampleMax: number | null
  sampleMean: number | null
}
