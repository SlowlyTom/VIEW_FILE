import React, { useState } from 'react'
import { FilePanel } from './components/FilePanel'
import { DataTable } from './components/DataTable'
import { ChartBuilder } from './components/ChartBuilder'
import { Dashboard } from './components/Dashboard'
import { ExportPanel } from './components/ExportPanel'

type Tab = 'table' | 'chart' | 'dashboard' | 'export'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'table', label: '데이터', icon: '📋' },
  { id: 'chart', label: '차트', icon: '📈' },
  { id: 'dashboard', label: '대시보드', icon: '📊' },
  { id: 'export', label: '내보내기', icon: '💾' }
]

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('table')

  return (
    <div className="h-screen flex flex-col bg-surface text-gray-900 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-0 bg-white border-b border-border px-4 h-10 shrink-0">
        <span className="text-primary font-bold mr-6 text-sm tracking-wide">ViewList</span>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 h-10 text-sm transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-gray-900 border-primary'
                : 'text-secondary border-transparent hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 shrink-0">
          <FilePanel />
        </div>

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'table' && <DataTable />}
          {activeTab === 'chart' && <ChartBuilder />}
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'export' && <ExportPanel />}
        </div>
      </div>
    </div>
  )
}

export default App
