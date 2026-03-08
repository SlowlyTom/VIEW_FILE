import { ipcMain, dialog } from 'electron'
import { getDb } from '../db'
import * as ExcelJS from 'exceljs'
import { createHash } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { basename, extname } from 'path'

interface ParsedColumn {
  columnId: string
  colIndex: number
  colName: string
  displayName: string
  dataType: 'number' | 'string' | 'datetime' | 'boolean'
  sampleMin: number | null
  sampleMax: number | null
  sampleMean: number | null
}

interface ParsedDataset {
  datasetId: string
  fileId: string
  sheetOrTable: string
  displayName: string
  rowCount: number
  colCount: number
  columns: ParsedColumn[]
  rows: Record<string, unknown>[]
}

function inferType(values: unknown[]): 'number' | 'string' | 'datetime' | 'boolean' {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '')
  if (nonNull.length === 0) return 'string'

  const boolCount = nonNull.filter(
    (v) => typeof v === 'boolean' || v === 'true' || v === 'false'
  ).length
  if (boolCount === nonNull.length) return 'boolean'

  const numCount = nonNull.filter(
    (v) => !isNaN(Number(v)) && typeof v !== 'boolean' && String(v).trim() !== ''
  ).length
  if (numCount / nonNull.length > 0.9) return 'number'

  const dateCount = nonNull.filter((v) => {
    if (v instanceof Date) return !isNaN(v.getTime())
    if (typeof v === 'string') {
      const d = new Date(v)
      return !isNaN(d.getTime()) && v.length > 4
    }
    return false
  }).length
  if (dateCount / nonNull.length > 0.8) return 'datetime'

  return 'string'
}

function computeStats(
  values: unknown[],
  type: string
): { min: number | null; max: number | null; mean: number | null } {
  if (type !== 'number') return { min: null, max: null, mean: null }
  const nums = values
    .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
    .map(Number)
  if (nums.length === 0) return { min: null, max: null, mean: null }
  return {
    min: Math.min(...nums),
    max: Math.max(...nums),
    mean: nums.reduce((a, b) => a + b, 0) / nums.length
  }
}

async function parseExcel(filePath: string, fileId: string): Promise<ParsedDataset[]> {
  const wb = new ExcelJS.Workbook()
  const ext = extname(filePath).toLowerCase()

  if (ext === '.xlsx') {
    await wb.xlsx.readFile(filePath)
  } else {
    // .xls — ExcelJS handles both but .xls support is limited
    await wb.xlsx.readFile(filePath)
  }

  const datasets: ParsedDataset[] = []

  wb.worksheets.forEach((ws) => {
    if (ws.rowCount < 1) return

    const headers: string[] = []
    const firstRow = ws.getRow(1)
    firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? `Column${colNumber}`)
    })

    const rows: Record<string, unknown>[] = []
    ws.eachRow({ includeEmpty: false }, (row, rowIndex) => {
      if (rowIndex === 1) return
      const rowData: Record<string, unknown> = {}
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const key = headers[colNumber - 1] || `Column${colNumber}`
        let val: unknown = cell.value
        // Unwrap rich text
        if (val !== null && typeof val === 'object' && 'richText' in val) {
          val = (val as { richText: { text: string }[] }).richText.map((r) => r.text).join('')
        }
        // Unwrap formula result
        if (val !== null && typeof val === 'object' && 'result' in val) {
          val = (val as { result: unknown }).result
        }
        rowData[key] = val
      })
      rows.push(rowData)
    })

    const datasetId = uuidv4()
    const columns: ParsedColumn[] = headers.map((header, idx) => {
      const vals = rows.map((r) => r[header])
      const type = inferType(vals)
      const stats = computeStats(vals, type)
      return {
        columnId: uuidv4(),
        colIndex: idx,
        colName: header,
        displayName: header,
        dataType: type,
        sampleMin: stats.min,
        sampleMax: stats.max,
        sampleMean: stats.mean
      }
    })

    datasets.push({
      datasetId,
      fileId,
      sheetOrTable: ws.name,
      displayName: ws.name,
      rowCount: rows.length,
      colCount: headers.length,
      columns,
      rows
    })
  })

  return datasets
}

async function parseMdb(filePath: string, fileId: string): Promise<ParsedDataset[]> {
  try {
    const ADODB = await import('node-adodb')
    const ext = extname(filePath).toLowerCase()
    const provider =
      ext === '.accdb'
        ? 'Provider=Microsoft.ACE.OLEDB.12.0'
        : 'Provider=Microsoft.Jet.OLEDB.4.0'

    const connection = ADODB.open(`${provider};Data Source=${filePath};`)

    // Schema constant 20 = adSchemaTables
    const tables = (await connection.schema(20)) as Array<{
      TABLE_NAME: string
      TABLE_TYPE: string
    }>
    const userTables = tables.filter((t) => t.TABLE_TYPE === 'TABLE')

    const datasets: ParsedDataset[] = []

    for (const table of userTables) {
      try {
        const rows = (await connection.query(
          `SELECT * FROM [${table.TABLE_NAME}]`
        )) as Record<string, unknown>[]
        if (rows.length === 0) continue

        const datasetId = uuidv4()
        const headers = Object.keys(rows[0])
        const columns: ParsedColumn[] = headers.map((header, idx) => {
          const vals = rows.map((r) => r[header])
          const type = inferType(vals)
          const stats = computeStats(vals, type)
          return {
            columnId: uuidv4(),
            colIndex: idx,
            colName: header,
            displayName: header,
            dataType: type,
            sampleMin: stats.min,
            sampleMax: stats.max,
            sampleMean: stats.mean
          }
        })

        datasets.push({
          datasetId,
          fileId,
          sheetOrTable: table.TABLE_NAME,
          displayName: table.TABLE_NAME,
          rowCount: rows.length,
          colCount: headers.length,
          columns,
          rows
        })
      } catch (tableErr) {
        console.error(`Error reading table ${table.TABLE_NAME}:`, tableErr)
      }
    }

    return datasets
  } catch (err) {
    console.error('node-adodb failed:', err)
    throw new Error(
      `MDB 파일 읽기 실패: node-adodb를 사용할 수 없습니다. Windows ODBC 드라이버를 확인하세요.\n${(err as Error).message}`
    )
  }
}

function saveToDb(
  fileId: string,
  filePath: string,
  fileHash: string,
  datasets: ParsedDataset[]
): void {
  const db = getDb()

  const insertFile = db.prepare(`
    INSERT OR REPLACE INTO source_files (file_id, file_path, file_name, file_type, file_hash)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertDataset = db.prepare(`
    INSERT OR REPLACE INTO datasets (dataset_id, file_id, sheet_or_table, display_name, row_count, col_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const insertColumn = db.prepare(`
    INSERT OR REPLACE INTO dataset_columns (column_id, dataset_id, col_index, col_name, display_name, data_type, sample_min, sample_max, sample_mean)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const ext = extname(filePath).slice(1).toLowerCase()
  const name = basename(filePath)

  const tx = db.transaction(() => {
    insertFile.run(fileId, filePath, name, ext, fileHash)
    for (const ds of datasets) {
      insertDataset.run(
        ds.datasetId,
        ds.fileId,
        ds.sheetOrTable,
        ds.displayName,
        ds.rowCount,
        ds.colCount
      )
      for (const col of ds.columns) {
        insertColumn.run(
          col.columnId,
          ds.datasetId,
          col.colIndex,
          col.colName,
          col.displayName,
          col.dataType,
          col.sampleMin,
          col.sampleMax,
          col.sampleMean
        )
      }
    }
  })
  tx()
}

export function registerFileHandlers(): void {
  ipcMain.handle('file:openDialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Data Files', extensions: ['xlsx', 'xls', 'mdb', 'accdb'] },
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'Access Files', extensions: ['mdb', 'accdb'] }
      ]
    })
    return result
  })

  ipcMain.handle('file:parse', async (_event, filePath: string) => {
    try {
      if (!existsSync(filePath)) {
        throw new Error(`파일을 찾을 수 없습니다: ${filePath}`)
      }

      const content = readFileSync(filePath)
      const fileHash = createHash('sha256').update(content).digest('hex')
      const fileId = uuidv4()
      const ext = extname(filePath).toLowerCase()

      let datasets: ParsedDataset[]

      if (ext === '.xlsx' || ext === '.xls') {
        datasets = await parseExcel(filePath, fileId)
      } else if (ext === '.mdb' || ext === '.accdb') {
        datasets = await parseMdb(filePath, fileId)
      } else {
        throw new Error(`지원하지 않는 파일 형식: ${ext}`)
      }

      saveToDb(fileId, filePath, fileHash, datasets)

      return {
        success: true,
        fileId,
        datasets: datasets.map((d) => ({ ...d, rows: d.rows }))
      }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
