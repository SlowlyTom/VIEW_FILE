import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  ResponsiveContainer,
  ReferenceArea
} from 'recharts'
import { useFileStore, type Dataset, type DataColumn } from '../../store/fileStore'
import { useCharts, type ChartConfig, type SeriesConfig, COLORS } from '../../hooks/useCharts'

// Recharts 마우스 이벤트 타입
interface RechartsMouseEvent {
  activeLabel?: string | number
  activeTooltipIndex?: number
  chartX?: number
  chartY?: number
}

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
  const [chartError, setChartError] = useState<string | null>(null)

  // 줌 상태 — 인덱스 기반
  const [zoomFromIdx, setZoomFromIdx] = useState<number | null>(null)
  const [zoomToIdx, setZoomToIdx] = useState<number | null>(null)

  // 드래그 상태 — ref로 stale closure 방지
  const refFromIdx = useRef<number | null>(null)
  const refToIdx = useRef<number | null>(null)
  const isDragging = useRef(false)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  // 드래그 시각적 피드백용 state (ReferenceArea에 label 값 필요)
  const [dragSelection, setDragSelection] = useState<{
    x1: string | number
    x2: string | number
  } | null>(null)

  const isZoomed = zoomFromIdx != null && zoomToIdx != null

  // 줌 리셋
  const resetZoom = useCallback(() => {
    setZoomFromIdx(null)
    setZoomToIdx(null)
  }, [])

  // 차트 데이터가 바뀌면 줌 리셋
  useEffect(() => {
    resetZoom()
  }, [chartData, resetZoom])

  // 줌 적용된 데이터 슬라이스
  const visibleData = useMemo(() => {
    if (zoomFromIdx == null || zoomToIdx == null) return chartData
    const from = Math.max(0, zoomFromIdx)
    const to = Math.min(chartData.length - 1, zoomToIdx)
    if (from > to) return chartData
    return chartData.slice(from, to + 1)
  }, [chartData, zoomFromIdx, zoomToIdx])

  // activeTooltipIndex(visibleData 기준) → chartData 전역 인덱스 변환
  const toGlobalIdx = useCallback(
    (tooltipIdx: number | undefined): number | null => {
      if (tooltipIdx == null || tooltipIdx < 0 || tooltipIdx >= visibleData.length) return null
      return (zoomFromIdx ?? 0) + tooltipIdx
    },
    [visibleData.length, zoomFromIdx]
  )

  // 줌 배율 계산
  const zoomLevel = useMemo(() => {
    if (!isZoomed || visibleData.length === 0) return 1
    return Math.round((chartData.length / visibleData.length) * 10) / 10
  }, [isZoomed, chartData.length, visibleData.length])

  // 줌인 (범위 10% 축소)
  const handleZoomIn = useCallback(() => {
    const total = chartData.length
    if (total === 0) return
    const fromIdx = zoomFromIdx ?? 0
    const toIdx = zoomToIdx ?? total - 1
    const visibleCount = toIdx - fromIdx + 1
    if (visibleCount <= 3) return
    const step = Math.max(1, Math.round(visibleCount * 0.1))
    const newFrom = Math.min(fromIdx + step, toIdx - 1)
    const newTo = Math.max(toIdx - step, fromIdx + 1)
    if (newFrom >= newTo) return
    setZoomFromIdx(newFrom)
    setZoomToIdx(newTo)
  }, [chartData.length, zoomFromIdx, zoomToIdx])

  // 줌아웃 (범위 10% 확장)
  const handleZoomOut = useCallback(() => {
    const total = chartData.length
    if (total === 0) return
    const fromIdx = zoomFromIdx ?? 0
    const toIdx = zoomToIdx ?? total - 1
    const visibleCount = toIdx - fromIdx + 1
    const step = Math.max(1, Math.round(visibleCount * 0.1))
    const newFrom = Math.max(0, fromIdx - step)
    const newTo = Math.min(total - 1, toIdx + step)
    if (newFrom <= 0 && newTo >= total - 1) {
      resetZoom()
    } else {
      setZoomFromIdx(newFrom)
      setZoomToIdx(newTo)
    }
  }, [chartData.length, zoomFromIdx, zoomToIdx, resetZoom])

  // 마우스 휠 줌 (passive: false로 직접 등록)
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      if (chartData.length === 0) return
      e.preventDefault()
      if (e.deltaY < 0) {
        handleZoomIn()
      } else {
        handleZoomOut()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [chartData, handleZoomIn, handleZoomOut])

  // 키보드 단축키 (+/-/Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (chartData.length === 0) return
      switch (e.key) {
        case '+':
        case '=':
          handleZoomIn()
          break
        case '-':
          handleZoomOut()
          break
        case 'Escape':
        case '0':
          resetZoom()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chartData, handleZoomIn, handleZoomOut, resetZoom])

  // 차트 밖에서 mouseup 시 드래그 취소
  useEffect(() => {
    const onGlobalMouseUp = (e: MouseEvent): void => {
      if (!isDragging.current) return
      const container = chartContainerRef.current
      if (container && container.contains(e.target as Node)) return
      isDragging.current = false
      refFromIdx.current = null
      refToIdx.current = null
      setDragSelection(null)
    }
    document.addEventListener('mouseup', onGlobalMouseUp)
    return () => document.removeEventListener('mouseup', onGlobalMouseUp)
  }, [])

  // 드래그 줌 핸들러 — activeTooltipIndex로 인덱스 직접 획득
  const handleMouseDown = useCallback(
    (e: RechartsMouseEvent) => {
      if (e == null) return
      const globalIdx = toGlobalIdx(e.activeTooltipIndex)
      if (globalIdx == null) return
      refFromIdx.current = globalIdx
      refToIdx.current = globalIdx
      isDragging.current = true
      // ReferenceArea 시각적 피드백용 label
      const label = e.activeLabel ?? visibleData[e.activeTooltipIndex!]?.x
      if (label != null) {
        setDragSelection({ x1: label as string | number, x2: label as string | number })
      }
    },
    [toGlobalIdx, visibleData]
  )

  const handleMouseMove = useCallback(
    (e: RechartsMouseEvent) => {
      if (!isDragging.current || e == null) return
      const globalIdx = toGlobalIdx(e.activeTooltipIndex)
      if (globalIdx == null) return
      refToIdx.current = globalIdx
      const label = e.activeLabel ?? visibleData[e.activeTooltipIndex!]?.x
      if (label != null) {
        setDragSelection((prev) =>
          prev ? { x1: prev.x1, x2: label as string | number } : null
        )
      }
    },
    [toGlobalIdx, visibleData]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    setDragSelection(null)

    const fromIdx = refFromIdx.current
    const toIdx = refToIdx.current
    refFromIdx.current = null
    refToIdx.current = null

    if (fromIdx == null || toIdx == null) return

    const diff = toIdx - fromIdx

    // 클릭 수준의 짧은 드래그는 무시
    if (Math.abs(diff) < 2) return

    if (diff > 0) {
      // 오른쪽 드래그 → 선택 범위로 줌인
      setZoomFromIdx(fromIdx)
      setZoomToIdx(toIdx)
    } else {
      // 왼쪽 드래그 → 드래그 거리에 비례하여 줌아웃
      const total = chartData.length
      const curFrom = zoomFromIdx ?? 0
      const curTo = zoomToIdx ?? total - 1
      const expand = Math.abs(diff)
      const newFrom = Math.max(0, curFrom - expand)
      const newTo = Math.min(total - 1, curTo + expand)
      if (newFrom <= 0 && newTo >= total - 1) {
        resetZoom()
      } else {
        setZoomFromIdx(newFrom)
        setZoomToIdx(newTo)
      }
    }
  }, [chartData.length, zoomFromIdx, zoomToIdx, resetZoom])

  // 더블클릭 줌 리셋
  const handleDoubleClick = useCallback(() => {
    resetZoom()
  }, [resetZoom])

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
    setChartError(null)

    if (!config.xAxis.datasetId || !config.xAxis.columnId) {
      setChartError('X축 데이터셋과 컬럼을 선택하세요.')
      return
    }
    if (config.series.length === 0) {
      setChartError('Y축 시리즈를 하나 이상 추가하세요.')
      return
    }
    const incompleteSeries = config.series.find((s) => !s.datasetId || !s.columnId)
    if (incompleteSeries) {
      setChartError('모든 시리즈의 데이터셋과 컬럼을 선택하세요.')
      return
    }
    if (config.joinMode === 'key' && !config.joinKeyColumn) {
      setChartError('키 조인 모드에서는 조인 키 컬럼을 설정하세요.')
      return
    }

    try {
      const data = buildChartData(config)
      if (data.length === 0) {
        setChartError('차트 데이터가 비어 있습니다. 데이터셋에 행 데이터가 있는지 확인하세요.')
        return
      }
      setChartData(data)
    } catch (err) {
      setChartError(`차트 생성 오류: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleSaveChart() {
    try {
      const result = await saveChart(config)
      if (result.success) {
        setSaveMsg('저장됨!')
      } else {
        setSaveMsg('저장 실패')
      }
    } catch {
      setSaveMsg('저장 오류')
    }
    setTimeout(() => setSaveMsg(''), 2000)
  }

  function renderChart() {
    const zoomMouseProps = {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp
    }

    const hasRightAxis = config.series.some((s) => s.yAxisId === 'right')

    const commonProps = {
      data: visibleData,
      margin: { top: 5, right: hasRightAxis ? 55 : 10, left: 0, bottom: 10 },
      ...zoomMouseProps
    }

    const tooltipStyle = {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 6,
      color: '#1e293b'
    }

    const yAxisLeft = (
      <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 11 }} allowDataOverflow domain={['auto', 'auto']} />
    )
    const yAxisRight = hasRightAxis ? (
      <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 11 }} allowDataOverflow domain={['auto', 'auto']} />
    ) : null

    // 드래그 중 선택 영역 표시 (강조된 파란색 오버레이)
    const selectionArea =
      dragSelection != null ? (
        <ReferenceArea
          x1={dragSelection.x1}
          x2={dragSelection.x2}
          yAxisId="left"
          stroke="#60a5fa"
          strokeWidth={2}
          strokeOpacity={0.9}
          fill="#3b82f6"
          fillOpacity={0.3}
        />
      ) : null

    switch (config.chart_type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 11 }} allowDataOverflow />
            {yAxisLeft}
            {yAxisRight}
            <Tooltip contentStyle={tooltipStyle} />
            <Legend verticalAlign="top" />
            {config.series.map((s) => (
              <Line
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={s.color}
                dot={false}
                strokeWidth={2}
                yAxisId={s.yAxisId ?? 'left'}
              />
            ))}
            {selectionArea}
          </LineChart>
        )
      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="x" name="X" stroke="#94a3b8" tick={{ fontSize: 11 }} allowDataOverflow />
            {yAxisLeft}
            {yAxisRight}
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }}
            />
            {config.series.map((s) => (
              <Scatter key={s.label} name={s.label} dataKey={s.label} fill={s.color} yAxisId={s.yAxisId ?? 'left'} />
            ))}
            {selectionArea}
          </ScatterChart>
        )
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 11 }} allowDataOverflow />
            {yAxisLeft}
            {yAxisRight}
            <Tooltip contentStyle={tooltipStyle} />
            <Legend verticalAlign="top" />
            {config.series.map((s) => (
              <Bar key={s.label} dataKey={s.label} fill={s.color} yAxisId={s.yAxisId ?? 'left'} />
            ))}
            {selectionArea}
          </BarChart>
        )
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 11 }} allowDataOverflow />
            {yAxisLeft}
            {yAxisRight}
            <Tooltip contentStyle={tooltipStyle} />
            <Legend verticalAlign="top" />
            {config.series.map((s) => (
              <Area
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.2}
                yAxisId={s.yAxisId ?? 'left'}
              />
            ))}
            {selectionArea}
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

  // 줌 미니바 계산
  const minibarStyle = useMemo(() => {
    const total = chartData.length
    if (total === 0) return { left: '0%', width: '100%' }
    const from = zoomFromIdx ?? 0
    const to = zoomToIdx ?? total - 1
    const leftPct = (from / total) * 100
    const widthPct = ((to - from + 1) / total) * 100
    return { left: `${leftPct}%`, width: `${widthPct}%` }
  }, [chartData.length, zoomFromIdx, zoomToIdx])

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
            className="w-full px-3 py-1.5 bg-white text-gray-900 text-sm rounded border border-border focus:outline-none focus:border-primary"
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
            className="w-full px-3 py-1.5 bg-white text-gray-900 text-sm rounded border border-border focus:outline-none focus:border-primary"
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
            className="w-full px-3 py-1.5 bg-white text-gray-900 text-sm rounded border border-border mb-2 focus:outline-none focus:border-primary"
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
              className="w-full px-3 py-1.5 bg-white text-gray-900 text-sm rounded border border-border focus:outline-none focus:border-primary"
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
                  className="flex-1 px-2 py-1 bg-white text-gray-900 text-xs rounded border border-border focus:outline-none focus:border-primary"
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
                className="w-full px-2 py-1 bg-white text-gray-900 text-xs rounded border border-border mb-1 focus:outline-none"
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
                  className="w-full px-2 py-1 bg-white text-gray-900 text-xs rounded border border-border focus:outline-none"
                >
                  <option value="">컬럼</option>
                  {(datasetColumns[s.datasetId] ?? []).map((col) => (
                    <option key={col.column_id} value={col.column_id}>
                      {col.display_name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-2 mt-1">
                <label
                  htmlFor={`yaxis-${idx}`}
                  className="text-xs text-secondary whitespace-nowrap flex-shrink-0"
                >
                  Y축
                </label>
                <select
                  id={`yaxis-${idx}`}
                  value={s.yAxisId ?? 'left'}
                  onChange={(e) => updateSeries(idx, { yAxisId: e.target.value as 'left' | 'right' })}
                  className="flex-1 px-2 py-1 bg-white text-gray-900 text-xs rounded border border-border focus:outline-none focus:border-primary"
                >
                  <option value="left">좌축 (기본)</option>
                  <option value="right">우축 (보조)</option>
                </select>
              </div>
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
              className="w-full px-3 py-1.5 bg-white text-gray-900 text-sm rounded border border-border focus:outline-none focus:border-primary"
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
            className="w-full px-3 py-1.5 bg-white text-gray-900 text-sm rounded border border-border focus:outline-none focus:border-primary"
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
            className="px-3 py-2 bg-white text-gray-900 text-sm rounded border border-border hover:bg-surface-2 transition-colors"
          >
            {saveMsg || '저장'}
          </button>
        </div>
        {chartError && (
          <div className="p-2 bg-red-50 text-red-600 text-xs rounded break-words border border-red-200">
            {chartError}
          </div>
        )}
      </div>

      {/* Chart Display */}
      <div className="flex-1 bg-surface p-6 overflow-hidden">
        {chartData.length > 0 ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-900 font-medium">{config.name}</h3>
              <div className="flex items-center gap-1.5">
                {/* 줌 레벨 항상 표시 */}
                <span
                  className={`text-xs mr-1 ${isZoomed ? 'text-blue-400 font-medium' : 'text-secondary'}`}
                >
                  {isZoomed
                    ? `${zoomLevel}x (${visibleData.length}/${chartData.length})`
                    : `1.0x (전체)`}
                </span>
                <button
                  onClick={handleZoomOut}
                  disabled={!isZoomed}
                  className="w-7 h-7 flex items-center justify-center text-sm bg-white text-secondary rounded border border-border hover:text-gray-900 hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="줌아웃 (- 또는 휠 다운)"
                >
                  −
                </button>
                <button
                  onClick={handleZoomIn}
                  className="w-7 h-7 flex items-center justify-center text-sm bg-white text-secondary rounded border border-border hover:text-gray-900 hover:border-primary transition-colors"
                  title="줌인 (+ 또는 휠 업)"
                >
                  +
                </button>
                <button
                  onClick={resetZoom}
                  disabled={!isZoomed}
                  className="px-2 h-7 flex items-center justify-center text-xs bg-white text-secondary rounded border border-border hover:text-gray-900 hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="전체 보기 (Esc 또는 더블클릭)"
                >
                  전체
                </button>
              </div>
            </div>
            <div className="text-xs text-secondary mb-1">
              휠: 줌 | 우→드래그: 확대 | 좌←드래그: 축소 | 더블클릭: 리셋
            </div>
            {/* 차트 영역 — userSelect: none으로 드래그 시 텍스트 선택 방지 */}
            <div
              ref={chartContainerRef}
              className="flex-1 min-h-0"
              style={{ cursor: 'crosshair', userSelect: 'none', WebkitUserSelect: 'none' }}
              onDoubleClick={handleDoubleClick}
            >
              <ResponsiveContainer width="100%" height="100%">
                {renderChart() as React.ReactElement}
              </ResponsiveContainer>
            </div>
            {/* 줌 미니바 — 전체 데이터 대비 현재 보이는 범위 시각화 */}
            <div className="mt-2 relative">
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden border border-border/50">
                <div
                  className={`absolute top-0 h-full rounded-full transition-all duration-200 ease-out ${
                    isZoomed ? 'bg-blue-500/80 shadow-[0_0_6px_rgba(59,130,246,0.5)]' : 'bg-gray-600/50'
                  }`}
                  style={{ left: minibarStyle.left, width: minibarStyle.width, top: 0 }}
                />
              </div>
              {/* 미니바 양쪽 인덱스 표시 */}
              {isZoomed && (
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px] text-blue-400/70">
                    {zoomFromIdx}
                  </span>
                  <span className="text-[10px] text-blue-400/70">
                    {zoomToIdx}
                  </span>
                </div>
              )}
            </div>
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
