import APIBase from './httpBase'

/** Inventario semanal (toma de los lunes): catálogo, conteo por bloques y utensilios con foto. */
export type InventoryCompany = 'nicole' | 'sucree'
export type InventoryProductBlock = 'pt' | 'pp' | 'mp'
export type InventoryBlock = InventoryProductBlock | 'ut'

export interface InventoryCatalogProduct {
  code: string
  name: string
  unit: string
}

export interface InventoryCatalogCategory {
  name: string
  products: InventoryCatalogProduct[]
}

export interface InventoryCatalogBlock {
  key: InventoryProductBlock
  title: string
  categories: InventoryCatalogCategory[]
}

export interface InventoryCatalog {
  company: InventoryCompany
  units: string[]
  blocks: InventoryCatalogBlock[]
  updatedBy?: string
  updatedAt?: string | null
}

export interface InventoryCountItem {
  code: string
  name: string
  category: string
  quantity: number
  unit: string
}

export interface InventoryUtensilCount {
  utensilId: string
  name: string
  quantity: number
}

export interface InventoryBlockState<T> {
  status: 'open' | 'closed'
  items: T[]
  closedAt: string | null
  closedBy: string | null
}

export interface InventoryCount {
  company: InventoryCompany
  weekOf: string // AAAA-MM-DD del lunes
  responsible: string
  pt: InventoryBlockState<InventoryCountItem>
  pp: InventoryBlockState<InventoryCountItem>
  mp: InventoryBlockState<InventoryCountItem>
  ut: InventoryBlockState<InventoryUtensilCount>
}

export interface InventoryUtensil {
  id: string
  name: string
  photo: string // data URL JPEG
}

export interface InventoryWeek {
  today: string
  weekOf: string
  count: InventoryCount
  utensils: InventoryUtensil[]
  /** Conteos de utensilios de semanas anteriores (de la más vieja a la más reciente). */
  history: Array<{ weekOf: string; utensils: Record<string, number> }>
}

class InventoryService extends APIBase {
  async getCatalog(company: InventoryCompany): Promise<InventoryCatalog> {
    const { data } = await this.get<any>(`inventory/catalog?company=${company}`)
    return data.data
  }

  async saveCatalog(catalog: Pick<InventoryCatalog, 'company' | 'blocks' | 'units'>): Promise<InventoryCatalog> {
    const { data } = await this.put<any>('inventory/catalog', catalog)
    return data.data
  }

  async getWeek(company: InventoryCompany): Promise<InventoryWeek> {
    const { data } = await this.get<any>(`inventory/week?company=${company}`)
    return data.data
  }

  async saveBlock(
    block: InventoryBlock,
    payload: {
      company: InventoryCompany
      responsible?: string
      items: Array<{ code: string; quantity: number; unit: string } | { utensilId: string; quantity: number }>
    },
  ): Promise<InventoryCount> {
    const { data } = await this.put<any>(`inventory/week/blocks/${block}`, payload)
    return data.data
  }

  async closeBlock(block: InventoryBlock, company: InventoryCompany): Promise<InventoryCount> {
    const { data } = await this.post<any>(`inventory/week/blocks/${block}/close`, { company })
    return data.data
  }

  async createUtensil(payload: { company: InventoryCompany; name: string; photo: string }): Promise<InventoryUtensil> {
    const { data } = await this.post<any>('inventory/utensils', payload)
    return data.data
  }
}

export const inventoryService = new InventoryService()
