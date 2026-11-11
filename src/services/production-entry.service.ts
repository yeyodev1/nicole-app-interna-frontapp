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

class ProductionEntryService extends APIBase {
  async getTabletData(): Promise<ProductionTabletData> {
    const { data } = await this.get<any>('production-entries/tablet')
    return data.data
  }

  async createEntry(payload: ProductionEntryPayload): Promise<{ id: string; totalUnits: number; operatorName: string }> {
    const { data } = await this.post<any>('production-entries', payload)
    return data.data
  }
}

export const productionEntryService = new ProductionEntryService()
