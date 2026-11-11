import APIBase from './httpBase'

/** Histórico de producción y lista de operarios: panel del Jefe de Operaciones. */
export interface HistoryEntryItem {
  code: string
  name: string
  category: string
  quantity: number
  unitPrice: number // PVP sin IVA
}

export interface HistoryEntry {
  id: string
  date: string // AAAA-MM-DD
  createdAt: string
  operatorId: string
  operatorName: string
  company: 'nicole' | 'sucree'
  area: string
  totalUnits: number
  value: number
  items: HistoryEntryItem[]
}

export interface HistoryWeek {
  from: string
  to: string
  closed: boolean
  daysWithoutEntry: number
  freeDays: number
  extraDays: number
  fine: number
}

export interface HistoryOperator {
  id: string
  name: string
  active: boolean
  photo: string | null
  mainArea: string | null
  entries: number
  units: number
  value: number
  daysWithEntry: number
  expectedDays: number
  unitsPerDay: number
  areaUnitsPerDay: number
  weeks: HistoryWeek[]
  fines: number
  extraDays: number
  score: { registro: number; productividad: number; valor: number; index: number }
}

export interface ProductionHistory {
  month: string // AAAA-MM
  today: string
  rules: { freeDaysPerWeek: number; finePerDay: number; weights: { registro: number; productividad: number; valor: number } }
  pricesAvailable: boolean
  totals: { entries: number; units: number; value: number; fines: number; extraDays: number; activeOperators: number }
  operators: HistoryOperator[]
  entries: HistoryEntry[]
}

export interface ProductionOperator {
  id: string
  name: string
  photo: string | null
  lastEntryAt: string | null
  createdAt: string
}

class ProductionHistoryService extends APIBase {
  async getHistory(month?: string): Promise<ProductionHistory> {
    const { data } = await this.get<any>('production-entries/history', undefined, { params: { month }, timeout: 60000 })
    return data.data
  }

  async listOperators(): Promise<ProductionOperator[]> {
    const { data } = await this.get<any>('production-entries/operators')
    return data.data
  }

  async addOperator(name: string): Promise<{ message: string }> {
    const { data } = await this.post<any>('production-entries/operators', { name })
    return data
  }

  async removeOperator(id: string): Promise<{ message: string }> {
    const { data } = await this.delete<any>(`production-entries/operators/${id}`)
    return data
  }
}

export const productionHistoryService = new ProductionHistoryService()

// ───────────── Ayudas compartidas por las vistas ─────────────
export const money = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const tierOf = (index: number) =>
  index >= 90 ? { cls: 's-top', label: 'Destacado' }
  : index >= 80 ? { cls: 's-good', label: 'Bueno' }
  : index >= 65 ? { cls: 's-mid', label: 'Por mejorar' }
  : { cls: 's-bad', label: 'Crítico' }

export const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })

export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })

export const timeOf = (isoDateTime: string) =>
  new Date(isoDateTime).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' })

export const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00`).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
