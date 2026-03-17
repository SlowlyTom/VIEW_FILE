import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // File operations
  openFileDialog: () => ipcRenderer.invoke('file:openDialog'),
  parseFile: (filePath: string) => ipcRenderer.invoke('file:parse', filePath),
  reparseFile: (fileId: string, filePath: string) =>
    ipcRenderer.invoke('file:reparse', fileId, filePath),
  getFiles: () => ipcRenderer.invoke('db:getFiles'),
  deleteFile: (fileId: string) => ipcRenderer.invoke('db:deleteFile', fileId),

  // Dataset operations
  getDatasets: (fileId: string) => ipcRenderer.invoke('db:getDatasets', fileId),
  getColumns: (datasetId: string) => ipcRenderer.invoke('db:getColumns', datasetId),

  // Chart operations
  saveChart: (config: unknown) => ipcRenderer.invoke('chart:save', config),
  getCharts: () => ipcRenderer.invoke('chart:getAll'),
  deleteChart: (configId: string) => ipcRenderer.invoke('chart:delete', configId),

  // Export operations
  exportExcel: (config: unknown) => ipcRenderer.invoke('export:excel', config),
  exportMdb: (config: unknown) => ipcRenderer.invoke('export:mdb', config),
  saveFileDialog: (defaultPath?: string, filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke('export:saveDialog', defaultPath, filters),

  // Dashboard operations
  saveDashboard: (dashboard: unknown) => ipcRenderer.invoke('db:saveDashboard', dashboard),
  getDashboards: () => ipcRenderer.invoke('db:getDashboards')
}

contextBridge.exposeInMainWorld('api', api)

export type ViewListAPI = typeof api
