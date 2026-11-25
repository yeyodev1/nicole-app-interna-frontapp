import APIBase from './httpBase'

/** Ingreso de producción: lo que usa la tablet de planta. */
export type ProductionCompany = 'nicole' | 'sucree'

export interface ProductionCatalogItem {
  code: string // código de Contífico
  name: string
  category: string
}

export interface ProductionTabletData {
  today: string // AAAA-MM-DD
  operators: Array<{ id: string; name: string }>
  areas: string[]
  catalog: Record<ProductionCompany, ProductionCatalogItem[]>
  rules: { freeDaysPerWeek: number; finePerDay: number }
}

export interface ProductionEntryPayload {
  operatorId: string
  company: ProductionCompany
  area: string
  items: Array<{ code: string; quantity: number }>
  photo: string // data URL JPEG comprimida
}

/** Ficha guardada (lo que se ve debajo del registro en la tablet). */
export interface ProductionDayEntry {
  id: string
  date: string // AAAA-MM-DD
  operatorName: string
  company: ProductionCompany
  area: string
  items: Array<{ code: string; name: string; category: string; quantity: number }>
  totalUnits: number
  createdAt: string
  editedAt: string | null
}

export interface ProductionDay {
  today: string
  date: string
  editable: boolean // solo las fichas de hoy, hasta las 00:00
  entries: ProductionDayEntry[]
}

class ProductionEntryService extends APIBase {
  async getTabletData(): Promise<ProductionTabletData> {
    const { data } = await this.get<any>('production-entries/tablet')
    return data.data
  }

  async createEntry(payload: ProductionEntryPayload): Promise<{ id: string; totalUnits: number; operatorName: string }> {
    const { data } = await this.post<any>('production-entries', payload)
    return data.data
  }

  async getDay(date?: string): Promise<ProductionDay> {
    const { data } = await this.get<any>('production-entries/day', undefined, { params: date ? { date } : {} })
    return data.data
  }

  async updateEntry(id: string, items: Array<{ code: string; quantity: number }>): Promise<{ id: string; totalUnits: number; editedAt: string }> {
    const { data } = await this.patch<any>(`production-entries/${id}`, { items })
    return data.data
  }
}

export const productionEntryService = new ProductionEntryService()
