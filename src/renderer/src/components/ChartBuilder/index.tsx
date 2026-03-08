import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { useFileStore, type Dataset, type DataColumn } from '../../store/fileStore'
import { useCharts, type ChartConfig, type SeriesConfig, COLORS } from '../../hooks/useCharts'

export function ChartBuilder() {
  const { files } = useFileStore()
  const { buildChartData, saveChart } = useCharts()

  const [allDatasets, setAllDatasets] = useState<Dataset[]>([])
  const [datasetColumns, setDatasetColumns] = useState<Record<string, DataColumn[]>>({})
  const [config, setConfig] = useState<ChartConfig>({
    name: '새 차트',
    chart_type: 'line',
    xAxis: { datasetId: '', columnId: '', columnName: '', label: '' },
    series: [],
    joinMode: 'index'
  })
  const [chartData, setChartData] = useState<Record<string, unknown>[]>([])
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    async function loadAll() {
      const all: Dataset[] = []
      for (const file of files) {
        const ds = await window.api.getDatasets(file.file_id)
        all.push(...ds)
      }
      setAllDatasets(all)
    }
    loadAll()
  }, [files])

  async function loadColumnsForDataset(datasetId: string) {
    if (!datasetColumns[datasetId]) {
      const cols = await window.api.getColumns(datasetId)
      setDatasetColumns((prev) => ({ ...prev, [datasetId]: cols }))
    }
  }

  async function handleXAxisDatasetChange(datasetId: string) {
    await loadColumnsForDataset(datasetId)
    setConfig((c) => ({
      ...c,
      xAxis: { ...c.xAxis, datasetId, columnId: '', columnName: '', label: '' }
    }))
  }

  function handleXAxisColumnChange(columnId: string) {
    const col = datasetColumns[config.xAxis.datasetId]?.find((c) => c.column_id === columnId)
    if (col) {
      setConfig((c) => ({
        ...c,
        xAxis: { ...c.xAxis, columnId, columnName: col.col_name, label: col.display_name }
      }))
    }
  }

  async function addSeries(datasetId: string) {
    await loadColumnsForDataset(datasetId)
    const newSeries: SeriesConfig = {
      datasetId,
      columnId: '',
      columnName: '',
      label: `Series ${config.series.length + 1}`,
      color: COLORS[config.series.length % COLORS.length]
    }
    setConfig((c) => ({ ...c, series: [...c.series, newSeries] }))
  }

  function updateSeries(idx: number, updates: Partial<SeriesConfig>) {
    setConfig((c) => {
      const series = [...c.series]
      series[idx] = { ...series[idx], ...updates }
      return { ...c, series }
    })
  }

  function updateSeriesColumn(idx: number, columnId: string) {
    const s = config.series[idx]
    const col = datasetColumns[s.datasetId]?.find((c) => c.column_id === columnId)
    if (col) {
      updateSeries(idx, { columnId, columnName: col.col_name, label: col.display_name })
    }
  }

  function removeSeries(idx: number) {
    setConfig((c) => ({ ...c, series: c.series.filter((_, i) => i !== idx) }))
  }

  function handleBuildChart() {
    const data = buildChartData(config)
    setChartData(data)
  }

  async function handleSaveChart() {
    const result = await saveChart(config)
    if (result.success) {
      setSaveMsg('저장됨!')
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  function renderChart() {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 20, left: 0, bottom: 5 }
    }

    const tooltipStyle = {
      backgroundColor: '#1e2130',
      border: '1px solid #374151',
      borderRadius: 6
    }

    switch (config.chart_type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="x" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {config.series.map((s) => (
              <Line
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={s.color}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        )
      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="x" name="X" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#1e2130', border: '1px solid #374151' }}
            />
            {config.series.map((s) => (
              <Scatter key={s.label} name={s.label} dataKey={s.label} fill={s.color} />
            ))}
          </ScatterChart>
        )
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="x" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {config.series.map((s) => (
              <Bar key={s.label} dataKey={s.label} fill={s.color} />
            ))}
          </BarChart>
        )
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="x" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {config.series.map((s) => (
              <Area
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.2}
              />
            ))}
          </AreaChart>
        )
      default:
        return (
          <div className="flex items-center justify-center h-full text-secondary">
            차트 타입을 선택하세요
          </div>
        )
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Config Panel */}
      <div className="w-80 bg-surface-2 border-r border-border p-4 overflow-y-auto flex flex-col gap-4 flex-shrink-0">
        <div>
          <label className="text-xs text-secondary uppercase tracking-wider mb-1 block">
            차트 이름
          </label>
          <input
            value={config.name}
            onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
            className="w-full px-3 py-1.5 bg-surface-3 text-white text-sm rounded border border-border focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs text-secondary uppercase tracking-wider mb-1 block">
            차트 타입
          </label>
          <select
            value={config.chart_type}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                chart_type: e.target.value as ChartConfig['chart_type']
              }))
            }
            className="w-full px-3 py-1.5 bg-surface-3 text-white text-sm rounded border border-border focus:outline-none focus:border-primary"
          >
            <option value="line">라인 차트</option>
            <option value="scatter">산점도</option>
            <option value="bar">막대 차트</option>
            <option value="area">영역 차트</option>
          </select>
        </div>

        <div className="border-t border-border pt-4">
          <label className="text-xs text-secondary uppercase tracking-wider mb-2 block">
            X축 설정
          </label>
          <select
            value={config.xAxis.datasetId}
            onChange={(e) => handleXAxisDatasetChange(e.target.value)}
            className="w-full px-3 py-1.5 bg-surface-3 text-white text-sm rounded border border-border mb-2 focus:outline-none focus:border-primary"
          >
            <option value="">데이터셋 선택</option>
            {allDatasets.map((ds) => (
              <option key={ds.dataset_id} value={ds.dataset_id}>
                {ds.display_name}
              </option>
            ))}
          </select>
          {config.xAxis.datasetId && (
            <select
              value={config.xAxis.columnId}
              onChange={(e) => handleXAxisColumnChange(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-3 text-white text-sm rounded border border-border focus:outline-none focus:border-primary"
            >
              <option value="">컬럼 선택</option>
              {(datasetColumns[config.xAxis.datasetId] ?? []).map((col) => (
                <option key={col.column_id} value={col.column_id}>
                  {col.display_name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-secondary uppercase tracking-wider">Y축 시리즈</label>
          </div>

          {config.series.map((s, idx) => (
            <div key={idx} className="mb-3 p-3 bg-surface-3 rounded border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <input
                  value={s.label}
                  onChange={(e) => updateSeries(idx, { label: e.target.value })}
                  className="flex-1 px-2 py-1 bg-surface text-white text-xs rounded border border-border focus:outline-none focus:border-primary"
                  placeholder="시리즈 이름"
                />
                <button
                  onClick={() => removeSeries(idx)}
                  className="text-secondary hover:text-red-400 text-sm flex-shrink-0"
                >
                  ×
                </button>
              </div>
              <select
                value={s.datasetId}
                onChange={async (e) => {
                  await loadColumnsForDataset(e.target.value)
                  updateSeries(idx, { datasetId: e.target.value, columnId: '', columnName: '' })
                }}
                className="w-full px-2 py-1 bg-surface text-white text-xs rounded border border-border mb-1 focus:outline-none"
              >
                <option value="">데이터셋</option>
                {allDatasets.map((ds) => (
                  <option key={ds.dataset_id} value={ds.dataset_id}>
                    {ds.display_name}
                  </option>
                ))}
              </select>
              {s.datasetId && (
                <select
                  value={s.columnId}
                  onChange={(e) => updateSeriesColumn(idx, e.target.value)}
                  className="w-full px-2 py-1 bg-surface text-white text-xs rounded border border-border focus:outline-none"
                >
                  <option value="">컬럼</option>
                  {(datasetColumns[s.datasetId] ?? []).map((col) => (
                    <option key={col.column_id} value={col.column_id}>
                      {col.display_name}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="color"
                value={s.color}
                onChange={(e) => updateSeries(idx, { color: e.target.value })}
                className="mt-1 w-full h-6 rounded cursor-pointer"
              />
            </div>
          ))}

          <div>
            <label className="text-xs text-secondary mb-1 block">시리즈 추가:</label>
            <select
              onChange={(e) => {
                if (e.target.value) addSeries(e.target.value)
                e.target.value = ''
              }}
              className="w-full px-3 py-1.5 bg-surface-3 text-white text-sm rounded border border-border focus:outline-none focus:border-primary"
            >
              <option value="">+ 데이터셋 선택</option>
              {allDatasets.map((ds) => (
                <option key={ds.dataset_id} value={ds.dataset_id}>
                  {ds.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <label className="text-xs text-secondary uppercase tracking-wider mb-2 block">
            조인 방식
          </label>
          <select
            value={config.joinMode}
            onChange={(e) =>
              setConfig((c) => ({ ...c, joinMode: e.target.value as 'index' | 'key' }))
            }
            className="w-full px-3 py-1.5 bg-surface-3 text-white text-sm rounded border border-border focus:outline-none focus:border-primary"
          >
            <option value="index">인덱스 조인 (행 순서)</option>
            <option value="key">키 조인 (공통 컬럼)</option>
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleBuildChart}
            className="flex-1 px-3 py-2 bg-primary text-white text-sm rounded hover:bg-blue-600 transition-colors"
          >
            차트 생성
          </button>
          <button
            onClick={handleSaveChart}
            className="px-3 py-2 bg-surface-3 text-white text-sm rounded border border-border hover:bg-surface transition-colors"
          >
            {saveMsg || '저장'}
          </button>
        </div>
      </div>

      {/* Chart Display */}
      <div className="flex-1 bg-surface p-6 overflow-hidden">
        {chartData.length > 0 ? (
          <div className="h-full flex flex-col">
            <h3 className="text-white font-medium mb-4">{config.name}</h3>
            <ResponsiveContainer width="100%" height="90%">
              {renderChart() as React.ReactElement}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-secondary">
            <div className="text-center">
              <div className="text-4xl mb-3">📈</div>
              <div>X축과 시리즈를 설정하고 "차트 생성"을 클릭하세요</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
