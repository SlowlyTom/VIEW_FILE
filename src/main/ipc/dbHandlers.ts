import { ipcMain } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'

export function registerDbHandlers(): void {
  ipcMain.handle('db:getFiles', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM source_files ORDER BY imported_at DESC').all()
  })

  ipcMain.handle('db:deleteFile', (_event, fileId: string) => {
    const db = getDb()
    db.prepare('DELETE FROM source_files WHERE file_id = ?').run(fileId)
    return { success: true }
  })

  ipcMain.handle('db:getDatasets', (_event, fileId: string) => {
    const db = getDb()
    return db
      .prepare('SELECT * FROM datasets WHERE file_id = ? ORDER BY display_name')
      .all(fileId)
  })

  ipcMain.handle('db:getColumns', (_event, datasetId: string) => {
    const db = getDb()
    return db
      .prepare('SELECT * FROM dataset_columns WHERE dataset_id = ? ORDER BY col_index')
      .all(datasetId)
  })

  ipcMain.handle(
    'db:saveDashboard',
    (
      _event,
      dashboard: { dashboard_id?: string; name: string; layout_json: string }
    ) => {
      const db = getDb()
      const id = dashboard.dashboard_id || uuidv4()
      db.prepare(`
        INSERT OR REPLACE INTO dashboards (dashboard_id, name, layout_json)
        VALUES (?, ?, ?)
      `).run(id, dashboard.name, dashboard.layout_json)
      return { success: true, dashboard_id: id }
    }
  )

  ipcMain.handle('db:getDashboards', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM dashboards ORDER BY created_at DESC').all()
  })
}
