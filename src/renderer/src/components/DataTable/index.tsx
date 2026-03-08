import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useFileStore, type DataColumn } from '../../store/fileStore'
import { useDataStore } from '../../store/dataStore'
import { computeStats } from '../../hooks/useDataset'

const PAGE_SIZE = 100

export function DataTable() {
  const { selectedDatasetId } = useFileStore()
  const { dataMap } = useDataStore()
  const [columns, setColumns] = useState<DataColumn[]>([])
  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [showStats, setShowStats] = useState(false)

  const rows = selectedDatasetId ? (dataMap.get(selectedDatasetId) ?? []) : []

  useEffect(() => {
    if (selectedDatasetId) {
      window.api.getColumns(selectedDatasetId).then(setColumns)
      setPage(0)
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

  const pageRows = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE)

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
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-surface-2 flex-shrink-0">
        <input
          type="text"
          placeholder="검색..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          className="px-3 py-1.5 bg-surface-3 text-white text-sm rounded border border-border focus:outline-none focus:border-primary w-48"
        />
        <span className="text-secondary text-sm">
          {filteredRows.length.toLocaleString()} / {rows.length.toLocaleString()} 행
        </span>
        <button
          onClick={() => setShowStats(!showStats)}
          className={`px-3 py-1.5 text-sm rounded border transition-colors ${
            showStats
              ? 'bg-primary border-primary text-white'
              : 'border-border text-secondary hover:text-white'
          }`}
        >
          통계
        </button>
      </div>

      {/* Stats panel */}
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
                    <div className="font-medium text-white mb-1">{col.display_name}</div>
                    <div className="text-secondary">
                      Min: <span className="text-white">{stats.min.toFixed(2)}</span>
                    </div>
                    <div className="text-secondary">
                      Max: <span className="text-white">{stats.max.toFixed(2)}</span>
                    </div>
                    <div className="text-secondary">
                      Mean: <span className="text-white">{stats.mean.toFixed(2)}</span>
                    </div>
                    <div className="text-secondary">
                      Std: <span className="text-white">{stats.stddev.toFixed(2)}</span>
                    </div>
                    <div className="text-secondary">
                      N: <span className="text-white">{stats.count.toLocaleString()}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
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
                  className="px-3 py-2 text-left text-secondary hover:text-white cursor-pointer border-b border-border whitespace-nowrap group font-normal"
                >
                  <span className="flex items-center gap-1">
                    {col.display_name}
                    <span className="text-xs opacity-50 group-hover:opacity-100">
                      {sortCol === col.col_name ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                    <span
                      className={`text-xs px-1 rounded ml-1 ${
                        col.data_type === 'number'
                          ? 'bg-blue-900/50 text-blue-300'
                          : col.data_type === 'datetime'
                            ? 'bg-purple-900/50 text-purple-300'
                            : 'bg-gray-700 text-gray-400'
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
            {pageRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-surface-3 transition-colors">
                <td className="px-2 py-1.5 text-secondary text-right text-xs border-b border-border/30">
                  {page * PAGE_SIZE + idx + 1}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.column_id}
                    className="px-3 py-1.5 border-b border-border/30 whitespace-nowrap"
                  >
                    <span className={col.data_type === 'number' ? 'text-blue-300' : 'text-gray-200'}>
                      {formatCell(row[col.col_name])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-2 border-t border-border bg-surface-2 flex-shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-sm text-secondary hover:text-white disabled:opacity-30"
          >
            ← 이전
          </button>
          <span className="text-secondary text-sm">
            {page + 1} / {totalPages} 페이지
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 text-sm text-secondary hover:text-white disabled:opacity-30"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  )
}
