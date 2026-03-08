import { create } from 'zustand'
import type { SourceFileRow, DatasetRow, ColumnRow } from '../api'

// Re-export type aliases for convenience
export type SourceFile = SourceFileRow
export type Dataset = DatasetRow
export type DataColumn = ColumnRow

interface FileState {
  files: SourceFile[]
  selectedFileId: string | null
  selectedDatasetId: string | null
  setFiles: (files: SourceFile[]) => void
  addFile: (file: SourceFile) => void
  removeFile: (fileId: string) => void
  setSelectedFile: (fileId: string | null) => void
  setSelectedDataset: (datasetId: string | null) => void
}

export const useFileStore = create<FileState>((set) => ({
  files: [],
  selectedFileId: null,
  selectedDatasetId: null,
  setFiles: (files) => set({ files }),
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  removeFile: (fileId) =>
    set((state) => ({
      files: state.files.filter((f) => f.file_id !== fileId),
      selectedFileId: state.selectedFileId === fileId ? null : state.selectedFileId,
      selectedDatasetId: state.selectedFileId === fileId ? null : state.selectedDatasetId
    })),
  setSelectedFile: (fileId) => set({ selectedFileId: fileId }),
  setSelectedDataset: (datasetId) => set({ selectedDatasetId: datasetId })
}))
