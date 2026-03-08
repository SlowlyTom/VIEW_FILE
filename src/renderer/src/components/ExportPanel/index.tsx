import React, { useState, useEffect } from 'react'
import { useFileStore, type Dataset, type DataColumn } from '../../store/fileStore'
import { useExport } from '../../hooks/useExport'

export function ExportPanel() {
  const { files } = useFileStore()
  const { exportToExcel, exportToMdb } = useExport()

  const [allDatasets, setAllDatasets] = useState<Dataset[]>([])
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([])
  const [datasetColumns, setDatasetColumns] = useState<Record<string, DataColumn[]>>({})
  const [selectedColumns, setSelectedColumns] = useState<Record<string, string[]>>({})
  const [mergeMode, setMergeMode] = useState<'separate_sheets' | 'single_sheet'>(
    'separate_sheets'
  )
  const [exportType, setExportType] = useState<'xlsx' | 'mdb'>('xlsx')
  const [mdbTableName, setMdbTableName] = useState('ExportedData')
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle'; msg: string }>({
    type: 'idle',
    msg: ''
  })

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

  async function toggleDataset(dsId: string) {
    if (!datasetColumns[dsId]) {
      const cols = await window.api.getColumns(dsId)
      setDatasetColumns((prev) => ({ ...prev, [dsId]: cols }))
      setSelectedColumns((prev) => ({ ...prev, [dsId]: cols.map((c) => c.col_name) }))
    }
    setSelectedDatasets((prev) =>
      prev.includes(dsId) ? prev.filter((id) => id !== dsId) : [...prev, dsId]
    )
  }

  function toggleColumn(dsId: string, colName: string) {
    setSelectedColumns((prev) => {
      const current = prev[dsId] ?? []
      return {
        ...prev,
        [dsId]: current.includes(colName)
          ? current.filter((c) => c !== colName)
          : [...current, colName]
      }
    })
  }

  async function handleExport() {
    setStatus({ type: 'idle', msg: '내보내는 중...' })

    try {
      if (exportType === 'xlsx') {
        const ds = selectedDatasets.map((dsId) => {
          const dataset = allDatasets.find((d) => d.dataset_id === dsId)!
          const cols = (selectedColumns[dsId] ?? []).map((name) => ({ name, key: name }))
          return {
            datasetId: dsId,
            sheetName: dataset.display_name,
            columns: cols
          }
        })

        const result = await exportToExcel(ds, mergeMode)
        if ((result as { canceled?: boolean }).canceled) {
          setStatus({ type: 'idle', msg: '' })
          return
        }
        if ((result as { success: boolean }).success) {
          setStatus({ type: 'success', msg: 'Excel 저장 완료!' })
        } else {
          setStatus({
            type: 'error',
            msg: (result as { error?: string }).error ?? '저장 실패'
          })
        }
      } else {
        if (selectedDatasets.length === 0) {
          setStatus({ type: 'error', msg: '데이터셋을 선택하세요' })
          return
        }
        const dsId = selectedDatasets[0]
        const cols = (selectedColumns[dsId] ?? []).map((name) => ({ name, key: name }))
        const result = await exportToMdb(dsId, mdbTableName, cols)
        if ((result as { canceled?: boolean }).canceled) {
          setStatus({ type: 'idle', msg: '' })
          return
        }
        if ((result as { success: boolean }).success) {
          setStatus({ type: 'success', msg: 'MDB 저장 완료!' })
        } else {
          setStatus({
            type: 'error',
            msg: (result as { error?: string }).error ?? '저장 실패'
          })
        }
      }
    } catch (e) {
      setStatus({ type: 'error', msg: String(e) })
    }

    setTimeout(() => setStatus({ type: 'idle', msg: '' }), 3000)
  }

  return (
    <div className="flex-1 p-6 bg-surface overflow-y-auto">
      <h2 className="text-white text-lg font-semibold mb-6">데이터 내보내기</h2>

      <div className="grid grid-cols-2 gap-6 max-w-4xl">
        <div>
          <label className="text-xs text-secondary uppercase tracking-wider mb-3 block">
            내보내기 형식
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setExportType('xlsx')}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                exportType === 'xlsx'
                  ? 'bg-primary text-white'
                  : 'bg-surface-3 text-secondary border border-border hover:text-white'
              }`}
            >
              📊 Excel (.xlsx)
            </button>
            <button
              onClick={() => setExportType('mdb')}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                exportType === 'mdb'
                  ? 'bg-primary text-white'
                  : 'bg-surface-3 text-secondary border border-border hover:text-white'
              }`}
            >
              🗄️ Access (.mdb)
            </button>
          </div>
        </div>

        {exportType === 'xlsx' && (
          <div>
            <label className="text-xs text-secondary uppercase tracking-wider mb-3 block">
              시트 구성
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setMergeMode('separate_sheets')}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  mergeMode === 'separate_sheets'
                    ? 'bg-primary text-white'
                    : 'bg-surface-3 text-secondary border border-border'
                }`}
              >
                시트 분리
              </button>
              <button
                onClick={() => setMergeMode('single_sheet')}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  mergeMode === 'single_sheet'
                    ? 'bg-primary text-white'
                    : 'bg-surface-3 text-secondary border border-border'
                }`}
              >
                단일 시트
              </button>
            </div>
          </div>
        )}

        {exportType === 'mdb' && (
          <div>
            <label className="text-xs text-secondary uppercase tracking-wider mb-3 block">
              테이블 이름
            </label>
            <input
              value={mdbTableName}
              onChange={(e) => setMdbTableName(e.target.value)}
              className="px-3 py-1.5 bg-surface-3 text-white text-sm rounded border border-border focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      <div className="mt-6 max-w-4xl">
        <label className="text-xs text-secondary uppercase tracking-wider mb-3 block">
          데이터셋 선택
        </label>
        {allDatasets.length === 0 ? (
          <div className="text-secondary text-sm">열린 파일이 없습니다</div>
        ) : (
          <div className="space-y-3">
            {allDatasets.map((ds) => (
              <div key={ds.dataset_id} className="bg-surface-2 rounded border border-border p-3">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedDatasets.includes(ds.dataset_id)}
                    onChange={() => toggleDataset(ds.dataset_id)}
                    className="w-4 h-4"
                  />
                  <span className="text-white font-medium">{ds.display_name}</span>
                  <span className="text-secondary text-sm">
                    {ds.row_count.toLocaleString()} 행
                  </span>
                </div>

                {selectedDatasets.includes(ds.dataset_id) && datasetColumns[ds.dataset_id] && (
                  <div className="ml-7">
                    <div className="text-xs text-secondary mb-2">컬럼 선택:</div>
                    <div className="flex flex-wrap gap-2">
                      {datasetColumns[ds.dataset_id].map((col) => (
                        <button
                          key={col.column_id}
                          onClick={() => toggleColumn(ds.dataset_id, col.col_name)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            (selectedColumns[ds.dataset_id] ?? []).includes(col.col_name)
                              ? 'bg-primary text-white'
                              : 'bg-surface-3 text-secondary border border-border'
                          }`}
                        >
                          {col.display_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleExport}
          disabled={selectedDatasets.length === 0}
          className="px-6 py-2 bg-primary text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          내보내기
        </button>
        {status.msg && (
          <span
            className={`text-sm ${
              status.type === 'error'
                ? 'text-red-400'
                : status.type === 'success'
                  ? 'text-green-400'
                  : 'text-secondary'
            }`}
          >
            {status.msg}
          </span>
        )}
      </div>
    </div>
  )
}
