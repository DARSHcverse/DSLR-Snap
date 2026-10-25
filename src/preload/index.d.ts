import type { BoothApi } from '../shared/api'

declare global {
  interface Window {
    booth: BoothApi
  }
}

export {}
