import APIBase from './httpBase'

/** Toma de inventario (una por día): catálogo, conteo por bloques y utensilios con foto. */
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
  reopenedAt?: string | null
  reopenedBy?: string | null
}

export interface InventoryCount {
  company: InventoryCompany
  weekOf: string // AAAA-MM-DD: fecha de la toma (las anteriores al 19/11/2026, el lunes de su semana)
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
  /** La toma es de hoy: se puede contar, cerrar y reabrir bloques. */
  editable: boolean
  /** La toma es de un día anterior y hoy es lunes: se puede empezar una nueva. */
  canStartNew: boolean
  /** Hoy es lunes: la toma de inventario se hace solo los lunes. */
  countDay?: boolean
  /** Ya existe al menos una toma de la empresa. */
  hasCount?: boolean
  count: InventoryCount
  utensils: InventoryUtensil[]
  /** Conteos de utensilios de las tomas anteriores (de la más vieja a la más reciente). */
  history: Array<{ weekOf: string; utensils: Record<string, number> }>
}

/** Movimiento de inventario (producto terminado): de una toma a la siguiente. Solo lectura. */
export interface InventoryMovementPeriod {
  from: string // AAAA-MM-DD: toma que abre el periodo
  to: string | null // toma que lo cierra; null = periodo abierto (hasta hoy)
  open: boolean
  responsible: string
  ptClosed: boolean
}

export interface InventoryMovementProduct {
  code: string
  name: string
  unit: string
  inCatalog: boolean
  start: number
  /** Lo contado en la toma que cierra el periodo; null si el periodo sigue abierto. */
  counted: number | null
  /** Un valor por día de `days`. */
  produced: number[]
  toIslands: number[]
  toOrders: number[]
}

export interface InventoryMovement {
  company: InventoryCompany
  empty: boolean
  open: boolean
  from: string
  to: string | null
  startAt: string
  endAt: string | null
  responsibleFrom: string
  responsibleTo: string
  startClosed: boolean
  endClosed: boolean | null
  days: string[]
  today: string
  categories: Array<{ name: string; products: InventoryMovementProduct[] }>
  /** Líneas despachadas que no están en el catálogo de producto terminado (no se restan). */
  unmatched: { lines: number; units: number; names: string[] }
  /** Comentarios del periodo por código de producto. */
  notes?: Record<string, InventoryMovementNote>
}

export interface InventoryMovementNote {
  code: string
  comment: string
  updatedBy: string
  updatedAt: string
}

class InventoryService extends APIBase {
  async getCatalog(company: InventoryCompany): Promise<InventoryCatalog> {
    const { data } = await this.get<any>(`inventory/catalog?company=${company}`)
    return data.data
  }

  /** Guarda el catálogo general. `aviso` llega si Contífico no respondió y no se revisaron los códigos. */
  async saveCatalog(
    catalog: Pick<InventoryCatalog, 'company' | 'blocks' | 'units'>,
  ): Promise<{ catalog: InventoryCatalog; aviso: string | null }> {
    const { data } = await this.put<any>('inventory/catalog', catalog)
    const { aviso = null, ...saved } = data.data || {}
    return { catalog: saved as InventoryCatalog, aviso }
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

  async reopenBlock(block: InventoryBlock, company: InventoryCompany): Promise<InventoryCount> {
    const { data } = await this.post<any>(`inventory/week/blocks/${block}/reopen`, { company })
    return data.data
  }

  async startNew(company: InventoryCompany): Promise<InventoryWeek> {
    const { data } = await this.post<any>('inventory/week/new', { company })
    return data.data
  }

  async createUtensil(payload: { company: InventoryCompany; name: string; photo: string }): Promise<InventoryUtensil> {
    const { data } = await this.post<any>('inventory/utensils', payload)
    return data.data
  }
  async getMovementPeriods(company: InventoryCompany): Promise<InventoryMovementPeriod[]> {
    const { data } = await this.get<any>(`inventory/movement/periods?company=${company}`)
    return data.data?.periods || []
  }

  /** `from` = fecha de la toma que abre el periodo; sin ella, el periodo abierto. */
  async getMovement(company: InventoryCompany, from?: string): Promise<InventoryMovement> {
    const q = from ? `&from=${encodeURIComponent(from)}` : ''
    const { data } = await this.get<any>(`inventory/movement?company=${company}${q}`)
    return data.data
  }

  /** Guarda (o borra, si el comentario va vacío) el comentario de un producto en el periodo. */
  async saveMovementNote(payload: { company: InventoryCompany; from: string; code: string; name: string; comment: string }): Promise<InventoryMovementNote | null> {
    const { data } = await this.put<any>('inventory/movement/notes', payload)
    return data.data
  }
}

export const inventoryService = new InventoryService()
