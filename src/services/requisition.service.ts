import APIBase from './httpBase'

export interface RequisitionItem {
  _id?: string
  material: any
  name: string
  quantity: number
  unit: string
  quantityDispatched?: number
  itemNote?: string
}

export interface Requisition {
  _id: string
  requestedBy: string
  requestedByName: string
  area: string
  /** MANUAL o POS_CLOSING (generado por el cierre de producción del punto de venta) */
  source?: 'MANUAL' | 'POS_CLOSING'
  branch?: string
  closingDate?: string
  brand?: string
  neededForDate?: string
  items: RequisitionItem[]
  status: 'REQUESTED' | 'PREPARING' | 'DISPATCHED' | 'CONFIRMED' | 'CANCELLED'
  notes?: string
  dispatchedBy?: string
  dispatchedAt?: string
  confirmedBy?: string
  confirmedAt?: string
  confirmationNote?: string
  createdAt: string
}

class RequisitionService extends APIBase {
  async createRequisition(data: Partial<Requisition>) {
    const response = await this.post<any>('requisitions', data)
    return response.data
  }

  async getRequisitions(params: any = {}) {
    const response = await this.get<any>('requisitions', undefined, { params })
    return response.data
  }

  async getPendingCount(): Promise<number> {
    const response = await this.get<{ count: number }>('requisitions/pending-count')
    return response.data.count
  }

  async updateStatus(id: string, status: 'PREPARING' | 'CANCELLED') {
    const response = await this.put<any>(`requisitions/${id}/status`, { status })
    return response.data
  }

  async dispatch(id: string, payload: { dispatchedBy?: string; items?: { itemId: string; quantityDispatched: number; itemNote?: string }[] }) {
    const response = await this.put<any>(`requisitions/${id}/dispatch`, payload)
    return response.data
  }

  async confirm(id: string, payload: { confirmedBy: string; confirmationNote?: string }) {
    const response = await this.put<any>(`requisitions/${id}/confirm`, payload)
    return response.data
  }
}

export default new RequisitionService()
