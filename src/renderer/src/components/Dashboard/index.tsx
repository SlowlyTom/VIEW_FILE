import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { useCharts, type ChartConfig } from '../../hooks/useCharts'

export function Dashboard() {
  const { savedCharts, loadSavedCharts, buildChartData } = useCharts()
  const [selectedCharts, setSelectedCharts] = useState<string[]>([])
  const [dashboardName, setDashboardName] = useState('대시보드')
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    loadSavedCharts()
  }, [loadSavedCharts])

  function toggleChart(configId: string) {
    setSelectedCharts((prev) =>
      prev.includes(configId) ? prev.filter((id) => id !== configId) : [...prev, configId]
    )
  }

  async function handleSaveDashboard() {
    const layout = selectedCharts.map((id, i) => ({
      configId: id,
      x: (i % 2) * 6,
      y: Math.floor(i / 2) * 4,
      w: 6,
      h: 4
    }))
    await window.api.saveDashboard({
      name: dashboardName,
      layout_json: JSON.stringify(layout)
    })
    setSaveMsg('저장됨!')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  function renderMiniChart(config: ChartConfig) {
    const data = buildChartData(config)
    if (data.length === 0)
      return <div className="text-secondary text-sm text-center py-8">데이터 없음</div>

    const hasRightAxis = config.series.some((s) => s.yAxisId === 'right')
    const props = { data, margin: { top: 5, right: hasRightAxis ? 30 : 5, left: -20, bottom: 5 } }
    const tooltipStyle = {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      fontSize: 11
    }

    const yAxisLeft = <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 9 }} />
    const yAxisRight = hasRightAxis ? (
      <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 9 }} />
    ) : null

    switch (config.chart_type) {
      case 'line':
        return (
          <LineChart {...props}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 9 }} />
            {yAxisLeft}
            {yAxisRight}
            <Tooltip contentStyle={tooltipStyle} />
            {config.series.map((s) => (
              <Line
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={s.color}
                dot={false}
                strokeWidth={1.5}
                yAxisId={s.yAxisId ?? 'left'}
              />
            ))}
          </LineChart>
        )
      case 'bar':
        return (
          <BarChart {...props}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 9 }} />
            {yAxisLeft}
            {yAxisRight}
            <Tooltip contentStyle={tooltipStyle} />
            {config.series.map((s) => (
              <Bar key={s.label} dataKey={s.label} fill={s.color} yAxisId={s.yAxisId ?? 'left'} />
            ))}
          </BarChart>
        )
      case 'area':
        return (
          <AreaChart {...props}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 9 }} />
            {yAxisLeft}
            {yAxisRight}
            <Tooltip contentStyle={tooltipStyle} />
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
          </AreaChart>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex-1 bg-surface overflow-y-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <input
          value={dashboardName}
          onChange={(e) => setDashboardName(e.target.value)}
          className="px-3 py-1.5 bg-white text-gray-900 text-lg font-semibold rounded border border-border focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleSaveDashboard}
          disabled={selectedCharts.length === 0}
          className="px-4 py-2 bg-primary text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {saveMsg || '레이아웃 저장'}
        </button>
      </div>

      {savedCharts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-secondary">
          <div className="text-4xl mb-3">📊</div>
          <div>저장된 차트가 없습니다</div>
          <div className="text-sm mt-1">차트 빌더에서 차트를 생성하고 저장하세요</div>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label className="text-xs text-secondary uppercase tracking-wider mb-2 block">
              대시보드에 추가할 차트 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {savedCharts.map((chart) => (
                <button
                  key={chart.config_id}
                  onClick={() => toggleChart(chart.config_id!)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    selectedCharts.includes(chart.config_id!)
                      ? 'bg-primary text-white'
                      : 'bg-white text-secondary border border-border hover:text-gray-900'
                  }`}
                >
                  {chart.name}
                </button>
              ))}
            </div>
          </div>

          {selectedCharts.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {selectedCharts.map((id) => {
                const chart = savedCharts.find((c) => c.config_id === id)
                if (!chart) return null
                return (
                  <div key={id} className="bg-surface-2 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-gray-900 font-medium">{chart.name}</h3>
                      <span className="text-xs text-secondary">{chart.chart_type}</span>
                    </div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        {(renderMiniChart(chart) as React.ReactElement) ?? <></>}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
