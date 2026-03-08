import { ipcMain } from 'electron'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'

export function registerChartHandlers(): void {
  ipcMain.handle(
    'chart:save',
    (
      _event,
      config: { config_id?: string; name: string; chart_type: string; config_json: string }
    ) => {
      const db = getDb()
      const id = config.config_id || uuidv4()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT OR REPLACE INTO chart_configs (config_id, name, chart_type, config_json, created_at, updated_at)
        VALUES (
          ?,
          ?,
          ?,
          ?,
          COALESCE((SELECT created_at FROM chart_configs WHERE config_id = ?), ?),
          ?
        )
      `).run(id, config.name, config.chart_type, config.config_json, id, now, now)
      return { success: true, config_id: id }
    }
  )

  ipcMain.handle('chart:getAll', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM chart_configs ORDER BY updated_at DESC').all()
  })

  ipcMain.handle('chart:delete', (_event, configId: string) => {
    const db = getDb()
    db.prepare('DELETE FROM chart_configs WHERE config_id = ?').run(configId)
    return { success: true }
  })
}
