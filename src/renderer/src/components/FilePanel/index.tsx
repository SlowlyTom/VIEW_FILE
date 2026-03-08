import React, { useEffect, useState } from 'react'
import { useFileStore, type Dataset } from '../../store/fileStore'
import { useDataStore } from '../../store/dataStore'

export function FilePanel() {
  const {
    files,
    selectedFileId,
    selectedDatasetId,
    setFiles,
    removeFile,
    setSelectedFile,
    setSelectedDataset
  } = useFileStore()
  const { setDataset } = useDataStore()
  const [datasets, setDatasets] = useState<Record<string, Dataset[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFiles()
  }, [])

  async function loadFiles() {
    const result = await window.api.getFiles()
    setFiles(result)
  }

  async function handleOpenFile() {
    const result = await window.api.openFileDialog()
    if (result.canceled || result.filePaths.length === 0) return

    setLoading(true)
    setError(null)

    for (const filePath of result.filePaths) {
      const parseResult = await window.api.parseFile(filePath)
      if (parseResult.success && parseResult.datasets) {
        // Store rows in memory
        for (const dataset of parseResult.datasets) {
          setDataset(dataset.datasetId, dataset.rows)
        }
        // Reload file list from DB
        const updatedFiles = await window.api.getFiles()
        setFiles(updatedFiles)
      } else {
        setError(parseResult.error ?? '알 수 없는 오류')
      }
    }

    setLoading(false)
  }

  async function handleSelectFile(fileId: string) {
    setSelectedFile(fileId)
    setSelectedDataset(null)
    if (!datasets[fileId]) {
      const ds = await window.api.getDatasets(fileId)
      setDatasets((prev) => ({ ...prev, [fileId]: ds }))
    }
  }

  function handleSelectDataset(datasetId: string) {
    setSelectedDataset(datasetId)
  }

  async function handleDeleteFile(fileId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await window.api.deleteFile(fileId)
    removeFile(fileId)
    setDatasets((prev) => {
      const next = { ...prev }
      delete next[fileId]
      return next
    })
  }

  function fileTypeIcon(type: string) {
    return type === 'xlsx' || type === 'xls' ? '📊' : '🗄️'
  }

  return (
    <div className="h-full flex flex-col bg-surface-2 border-r border-border">
      <div className="p-3 border-b border-border">
        <button
          onClick={handleOpenFile}
          disabled={loading}
          className="w-full px-3 py-2 bg-primary text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {loading ? '파일 읽는 중...' : '+ 파일 열기'}
        </button>
        {error && (
          <div className="mt-2 p-2 bg-red-900/50 text-red-300 text-xs rounded break-words">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-4 text-secondary text-sm text-center">
            <div className="text-2xl mb-2">📂</div>
            <div>파일을 열어주세요</div>
            <div className="text-xs mt-1 opacity-70">.xlsx, .xls, .mdb, .accdb</div>
          </div>
        ) : (
          files.map((file) => (
            <div key={file.file_id} className="border-b border-border/50">
              <div
                className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-surface-3 transition-colors ${
                  selectedFileId === file.file_id ? 'bg-surface-3' : ''
                }`}
                onClick={() => handleSelectFile(file.file_id)}
              >
                <span className="text-lg flex-shrink-0">
                  {fileTypeIcon(file.file_type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {file.file_name}
                  </div>
                  <div className="text-xs text-secondary truncate">{file.file_path}</div>
                </div>
                <button
                  onClick={(e) => handleDeleteFile(file.file_id, e)}
                  className="text-secondary hover:text-red-400 text-sm p-1 flex-shrink-0"
                  title="제거"
                >
                  ×
                </button>
              </div>

              {selectedFileId === file.file_id && datasets[file.file_id] && (
                <div className="pl-4 bg-surface/50">
                  {datasets[file.file_id].map((ds) => (
                    <div
                      key={ds.dataset_id}
                      onClick={() => handleSelectDataset(ds.dataset_id)}
                      className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-surface-3 text-sm transition-colors ${
                        selectedDatasetId === ds.dataset_id
                          ? 'text-primary bg-surface-3'
                          : 'text-gray-300'
                      }`}
                    >
                      <span className="text-xs flex-shrink-0">📋</span>
                      <span className="truncate">{ds.display_name}</span>
                      <span className="ml-auto text-xs text-secondary flex-shrink-0">
                        {ds.row_count.toLocaleString()}행
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
