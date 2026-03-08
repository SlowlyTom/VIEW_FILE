import { useCallback } from 'react'
import { useDataStore } from '../store/dataStore'
import type { DataColumn } from '../store/fileStore'

export function useDataset(datasetId: string | null) {
  const { dataMap, setDataset } = useDataStore()

  const rows = datasetId ? (dataMap.get(datasetId) ?? []) : []

  const loadDataset = useCallback(
    async (dsId: string, parsedRows: Record<string, unknown>[]) => {
      setDataset(dsId, parsedRows)
    },
    [setDataset]
  )

  const getFilteredRows = useCallback(
    (
      sourceRows: Record<string, unknown>[],
      filters: Array<{ column: string; operator: string; value: string }>
    ) => {
      return sourceRows.filter((row) => {
        return filters.every((f) => {
          const val = row[f.column]
          const strVal = String(val ?? '').toLowerCase()
          const filterVal = f.value.toLowerCase()

          switch (f.operator) {
            case 'contains':
              return strVal.includes(filterVal)
            case 'equals':
              return strVal === filterVal
            case 'gt':
              return Number(val) > Number(f.value)
            case 'lt':
              return Number(val) < Number(f.value)
            case 'gte':
              return Number(val) >= Number(f.value)
            case 'lte':
              return Number(val) <= Number(f.value)
            default:
              return true
          }
        })
      })
    },
    []
  )

  return { rows, loadDataset, getFilteredRows }
}

export function computeStats(rows: Record<string, unknown>[], column: DataColumn) {
  if (column.data_type !== 'number') return null
  const nums = rows
    .map((r) => Number(r[column.col_name]))
    .filter((n) => !isNaN(n))
  if (nums.length === 0) return null
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length
  return {
    min: Math.min(...nums),
    max: Math.max(...nums),
    mean,
    stddev: Math.sqrt(variance),
    count: nums.length
  }
}
