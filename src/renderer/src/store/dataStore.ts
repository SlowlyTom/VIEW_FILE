import { create } from 'zustand'

export type RowData = Record<string, unknown>

interface DataState {
  // Map from datasetId -> rows
  dataMap: Map<string, RowData[]>
  setDataset: (datasetId: string, rows: RowData[]) => void
  getDataset: (datasetId: string) => RowData[] | undefined
  clearDataset: (datasetId: string) => void
  clearAll: () => void
}

export const useDataStore = create<DataState>((set, get) => ({
  dataMap: new Map(),
  setDataset: (datasetId, rows) =>
    set((state) => {
      const newMap = new Map(state.dataMap)
      newMap.set(datasetId, rows)
      return { dataMap: newMap }
    }),
  getDataset: (datasetId) => get().dataMap.get(datasetId),
  clearDataset: (datasetId) =>
    set((state) => {
      const newMap = new Map(state.dataMap)
      newMap.delete(datasetId)
      return { dataMap: newMap }
    }),
  clearAll: () => set({ dataMap: new Map() })
}))
