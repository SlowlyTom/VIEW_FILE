import { useCallback } from 'react'
import { useDataStore } from '../store/dataStore'

export function useExport() {
  const { dataMap } = useDataStore()

  const exportToExcel = useCallback(
    async (
      datasets: Array<{
        datasetId: string
        sheetName: string
        columns: Array<{ name: string; key: string }>
        filterFn?: (row: Record<string, unknown>) => boolean
      }>,
      mergeMode: 'separate_sheets' | 'single_sheet' = 'separate_sheets'
    ) => {
      const dialogResult = await window.api.saveFileDialog(undefined, [
        { name: 'Excel Files', extensions: ['xlsx'] }
      ])
      if (dialogResult.canceled || !dialogResult.filePath)
        return { success: false, canceled: true }

      const exportDatasets = datasets.map((ds) => {
        const allRows = dataMap.get(ds.datasetId) ?? []
        const filteredRows = ds.filterFn ? allRows.filter(ds.filterFn) : allRows
        return {
          sheetName: ds.sheetName,
          columns: ds.columns,
          rows: filteredRows
        }
      })

      return window.api.exportExcel({
        datasets: exportDatasets,
        mergeMode,
        outputPath: dialogResult.filePath
      })
    },
    [dataMap]
  )

  const exportToMdb = useCallback(
    async (
      datasetId: string,
      tableName: string,
      columns: Array<{ name: string; key: string }>,
      filterFn?: (row: Record<string, unknown>) => boolean
    ) => {
      const dialogResult = await window.api.saveFileDialog(undefined, [
        { name: 'Access Files', extensions: ['mdb'] }
      ])
      if (dialogResult.canceled || !dialogResult.filePath)
        return { success: false, canceled: true }

      const allRows = dataMap.get(datasetId) ?? []
      const filteredRows = filterFn ? allRows.filter(filterFn) : allRows

      return window.api.exportMdb({
        tableName,
        columns,
        rows: filteredRows,
        targetMdbPath: dialogResult.filePath
      })
    },
    [dataMap]
  )

  return { exportToExcel, exportToMdb }
}
