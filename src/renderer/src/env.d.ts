/// <reference types="vite/client" />

import type { ViewListAPI } from './api'

declare global {
  interface Window {
    api: ViewListAPI
  }
}
