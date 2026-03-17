import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as ExcelJS from 'exceljs'
import { createRequire } from 'module'

const _require = createRequire(import.meta.url)

interface ExportColumn {
  name: string
  key: string
}

interface ExportDataset {
  sheetName: string
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
}

interface ExcelExportConfig {
  datasets: ExportDataset[]
  mergeMode: 'separate_sheets' | 'single_sheet'
  outputPath: string
}

interface MdbExportConfig {
  tableName: string
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
  targetMdbPath: string
}

export function registerExportHandlers(): void {
  ipcMain.handle(
    'export:saveDialog',
    async (_event, defaultPath?: string, filters?: Electron.FileFilter[]) => {
      try
      {
        const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined
        const result = await dialog.showSaveDialog(win!, {
          defaultPath,
          filters: filters || [
            { name: 'Excel Files', extensions: ['xlsx'] },
            { name: 'Access Files', extensions: ['mdb'] }
          ]
        })
        return result
      }
      catch (err)
      {
        console.error('export:saveDialog error:', err)
        return { canceled: true, filePath: '' }
      }
    }
  )

  ipcMain.handle('export:excel', async (_event, config: ExcelExportConfig) => {
    try {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'ViewList'
      wb.created = new Date()

      if (config.mergeMode === 'separate_sheets') {
        for (const dataset of config.datasets) {
          const ws = wb.addWorksheet(dataset.sheetName || 'Sheet1')
          ws.columns = dataset.columns.map((col) => ({
            header: col.name,
            key: col.key,
            width: 15
          }))
          for (const row of dataset.rows) {
            ws.addRow(row)
          }
          // Style header row
          ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
          ws.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3B82F6' }
          }
        }
      } else {
        const ws = wb.addWorksheet('Data')
        if (config.datasets.length > 0) {
          ws.columns = config.datasets[0].columns.map((col) => ({
            header: col.name,
            key: col.key,
            width: 15
          }))
          for (const dataset of config.datasets) {
            for (const row of dataset.rows) {
              ws.addRow(row)
            }
          }
          ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
          ws.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3B82F6' }
          }
        }
      }

      await wb.xlsx.writeFile(config.outputPath)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('export:mdb', async (_event, config: MdbExportConfig) => {
    try {
      const ADODB = _require('node-adodb') as typeof import('node-adodb')
      const connection = ADODB.open(
        `Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${config.targetMdbPath};`
      )

      const colDefs = config.columns.map((col) => `[${col.name}] TEXT(255)`).join(', ')
      await connection.execute(`CREATE TABLE [${config.tableName}] (${colDefs})`)

      const batchSize = 100
      for (let i = 0; i < config.rows.length; i += batchSize) {
        const batch = config.rows.slice(i, i + batchSize)
        for (const row of batch) {
          const vals = config.columns
            .map((col) => {
              const v = row[col.key]
              if (v === null || v === undefined) return 'NULL'
              return `'${String(v).replace(/'/g, "''")}'`
            })
            .join(', ')
          const colNames = config.columns.map((c) => `[${c.name}]`).join(', ')
          await connection.execute(
            `INSERT INTO [${config.tableName}] (${colNames}) VALUES (${vals})`
          )
        }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
