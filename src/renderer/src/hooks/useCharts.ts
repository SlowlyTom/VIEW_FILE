import { useState, useCallback } from 'react'
import { useDataStore } from '../store/dataStore'
import type { ChartConfigRow } from '../api'

export interface SeriesConfig {
  datasetId: string
  columnId: string
  columnName: string
  label: string
  color: string
  yAxisId?: 'left' | 'right'
}

export interface XAxisConfig {
  datasetId: string
  columnId: string
  columnName: string
  label: string
}

export interface ChartConfig {
  config_id?: string
  name: string
  chart_type: 'line' | 'scatter' | 'bar' | 'histogram' | 'area' | 'box'
  xAxis: XAxisConfig
  series: SeriesConfig[]
  joinMode: 'index' | 'key'
  joinKeyColumn?: string
}

export const COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16'
]

function rowToChartConfigFields(row: ChartConfigRow): Partial<ChartConfig> {
  try {
    return JSON.parse(row.config_json) as Partial<ChartConfig>
  } catch {
    return {}
  }
}

export function useCharts() {
  const { dataMap } = useDataStore()
  const [savedCharts, setSavedCharts] = useState<ChartConfig[]>([])

  const buildChartData = useCallback(
    (config: ChartConfig): Record<string, unknown>[] => {
      if (!config.xAxis?.datasetId || config.series.length === 0) return []

      const xRows = dataMap.get(config.xAxis.datasetId) ?? []

      if (config.joinMode === 'index') {
        const seriesLengths = config.series.map(
          (s) => (dataMap.get(s.datasetId) ?? []).length
        )
        const minLen = seriesLengths.length > 0
          ? Math.min(xRows.length, ...seriesLengths)
          : 0
        return Array.from({ length: minLen }, (_, i) => {
          const point: Record<string, unknown> = {
            x: xRows[i]?.[config.xAxis.columnName]
          }
          config.series.forEach((s) => {
            const rows = dataMap.get(s.datasetId) ?? []
            point[s.label] = rows[i]?.[s.columnName]
          })
          return point
        })
      } else {
        // Key join
        if (!config.joinKeyColumn) return []
        const keyMap = new Map<string, Record<string, unknown>>()

        xRows.forEach((row) => {
          const key = String(row[config.xAxis.columnName] ?? '')
          keyMap.set(key, { x: row[config.xAxis.columnName] })
        })

        config.series.forEach((s) => {
          const rows = dataMap.get(s.datasetId) ?? []
          rows.forEach((row) => {
            const key = String(row[config.joinKeyColumn!] ?? '')
            if (keyMap.has(key)) {
              keyMap.get(key)![s.label] = row[s.columnName]
            }
          })
        })

        return Array.from(keyMap.values()).sort((a, b) => {
          const ax = a.x,
            bx = b.x
          if (ax instanceof Date && bx instanceof Date) return ax.getTime() - bx.getTime()
          return String(ax).localeCompare(String(bx))
        })
      }
    },
    [dataMap]
  )

  const loadSavedCharts = useCallback(async () => {
    const rows: ChartConfigRow[] = await window.api.getCharts()
    setSavedCharts(
      rows.map((r) => ({
        config_id: r.config_id,
        name: r.name,
        chart_type: r.chart_type as ChartConfig['chart_type'],
        xAxis: { datasetId: '', columnId: '', columnName: '', label: '' },
        series: [],
        joinMode: 'index',
        ...rowToChartConfigFields(r)
      }))
    )
  }, [])

  const saveChart = useCallback(async (config: ChartConfig) => {
    const { xAxis, series, joinMode, joinKeyColumn } = config
    const configJson = JSON.stringify({ xAxis, series, joinMode, joinKeyColumn })
    const result = await window.api.saveChart({
      config_id: config.config_id,
      name: config.name,
      chart_type: config.chart_type,
      config_json: configJson
    })
    return result
  }, [])

  return { buildChartData, savedCharts, loadSavedCharts, saveChart, COLORS }
}
