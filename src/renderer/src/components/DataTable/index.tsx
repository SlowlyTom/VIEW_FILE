import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useFileStore, type DataColumn } from '../../store/fileStore'
import { useDataStore } from '../../store/dataStore'
import { computeStats } from '../../hooks/useDataset'

const ROW_HEIGHT = 32

export function DataTable() {
  const { selectedDatasetId } = useFileStore()
  const { dataMap } = useDataStore()
  const [columns, setColumns] = useState<DataColumn[]>([])
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [showStats, setShowStats] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const rows = selectedDatasetId ? (dataMap.get(selectedDatasetId) ?? []) : []

  useEffect(() => {
    if (selectedDatasetId) {
      window.api.getColumns(selectedDatasetId).then(setColumns)
      setSortCol(null)
      setSearch('')
    } else {
      setColumns([])
    }
  }, [selectedDatasetId])

  const filteredRows = useMemo(() => {
    if (!search) return rows
    const lower = search.toLowerCase()
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(lower))
    )
  }, [rows, search])

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows
    return [...filteredRows].sort((a, b) => {
      const av = a[sortCol],
        bv = b[sortCol]
      let cmp = 0
      if (av === null || av === undefined) cmp = 1
      else if (bv === null || bv === undefined) cmp = -1
      else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredRows, sortCol, sortDir])

  // 가상 스크롤
  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  // 검색/정렬 변경 시 스크롤 초기화
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [search, sortCol, sortDir, selectedDatasetId])

  // 현재 보이는 범위
  const firstVisible = virtualRows.length > 0 ? virtualRows[0].index + 1 : 0
  const lastVisible =
    virtualRows.length > 0 ? virtualRows[virtualRows.length - 1].index + 1 : 0

  // 스페이서 계산 (thead/tbody 자연스러운 테이블 플로우 유지)
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - virtualRows[virtualRows.length - 1].end
      : 0

  const handleSort = useCallback(
    (col: string) => {
      if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      else {
        setSortCol(col)
        setSortDir('asc')
      }
    },
    [sortCol]
  )

  function formatCell(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (value instanceof Date) return value.toLocaleDateString('ko-KR')
    if (typeof value === 'number') {
      if (Number.isInteger(value)) return value.toLocaleString()
      return value.toFixed(4)
    }
    return String(value)
  }

  if (!selectedDatasetId) {
    return (
      <div className="flex-1 flex items-center justify-center text-secondary">
        <div className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <div>왼쪽 패널에서 데이터셋을 선택하세요</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* 툴바 */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-surface-2 flex-shrink-0">
        <input
          type="text"
          placeholder="검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 bg-white text-gray-900 text-sm rounded border border-border focus:outline-none focus:border-primary w-48"
        />
        <span className="text-secondary text-sm">
          {filteredRows.length.toLocaleString()} / {rows.length.toLocaleString()} 행
        </span>
        {sortedRows.length > 0 && (
          <span className="text-secondary text-xs ml-auto mr-2">
            {firstVisible.toLocaleString()}–{lastVisible.toLocaleString()} 표시 중
          </span>
        )}
        <button
          onClick={() => setShowStats(!showStats)}
          className={`px-3 py-1.5 text-sm rounded border transition-colors ${
            showStats
              ? 'bg-primary border-primary text-white'
              : 'border-border text-secondary hover:text-gray-900'
          }`}
        >
          통계
        </button>
      </div>

      {/* 통계 패널 */}
      {showStats && columns.length > 0 && (
        <div className="p-3 border-b border-border bg-surface-2 overflow-x-auto flex-shrink-0">
          <div className="flex gap-4">
            {columns
              .filter((c) => c.data_type === 'number')
              .map((col) => {
                const stats = computeStats(rows, col)
                if (!stats) return null
                return (
                  <div
                    key={col.column_id}
                    className="bg-surface-3 rounded p-2 text-xs min-w-32"
                  >
                    <div className="font-medium text-gray-900 mb-1">{col.display_name}</div>
                    <div className="text-secondary">
                      Min: <span className="text-gray-900">{stats.min.toFixed(2)}</span>
                    </div>
                    <div className="text-secondary">
                      Max: <span className="text-gray-900">{stats.max.toFixed(2)}</span>
                    </div>
                    <div className="text-secondary">
                      Mean: <span className="text-gray-900">{stats.mean.toFixed(2)}</span>
                    </div>
                    <div className="text-secondary">
                      Std: <span className="text-gray-900">{stats.stddev.toFixed(2)}</span>
                    </div>
                    <div className="text-secondary">
                      N: <span className="text-gray-900">{stats.count.toLocaleString()}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* 테이블 — 가상 스크롤 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-surface-2 z-10">
            <tr>
              <th className="w-12 px-2 py-2 text-secondary text-right border-b border-border font-normal">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.column_id}
                  onClick={() => handleSort(col.col_name)}
                  className="px-3 py-2 text-left text-secondary hover:text-gray-900 cursor-pointer border-b border-border whitespace-nowrap group font-normal"
                >
                  <span className="flex items-center gap-1">
                    {col.display_name}
                    <span className="text-xs opacity-50 group-hover:opacity-100">
                      {sortCol === col.col_name ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                    <span
                      className={`text-xs px-1 rounded ml-1 ${
                        col.data_type === 'number'
                          ? 'bg-blue-100 text-blue-700'
                          : col.data_type === 'datetime'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {col.data_type === 'number'
                        ? '#'
                        : col.data_type === 'datetime'
                          ? 'D'
                          : 'T'}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 상단 스페이서 */}
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: paddingTop, padding: 0, border: 'none' }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = sortedRows[virtualRow.index]
              return (
                <tr key={virtualRow.index} className="hover:bg-surface-3 transition-colors">
                  <td className="px-2 py-1.5 text-secondary text-right text-xs border-b border-border/30 w-12">
                    {virtualRow.index + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.column_id}
                      className="px-3 py-1.5 border-b border-border/30 whitespace-nowrap"
                    >
                      <span
                        className={col.data_type === 'number' ? 'text-blue-700' : 'text-gray-700'}
                      >
                        {formatCell(row[col.col_name])}
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })}
            {/* 하단 스페이서 */}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: paddingBottom, padding: 0, border: 'none' }} />
              </tr>
            )}
            {sortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="text-center py-8 text-secondary"
                >
                  데이터가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
