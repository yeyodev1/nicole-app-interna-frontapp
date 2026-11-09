import APIBase from './httpBase'

export interface DispatchItem {
  productId: string
  name: string
  quantitySent: number
  quantityReceived?: number
  itemStatus?: 'OK' | 'MISSING' | 'DAMAGED'
}

export interface IncomingDispatch {
  orderId: string
  orderNumber?: string
  customerName: string
  deliveryDate: string
  products: any[]
  dispatch: {
    _id: string
    reportedAt: string
    destination: string
    items: DispatchItem[]
    notes?: string
    reportedBy: string
    receptionStatus: 'PENDING' | 'RECEIVED' | 'PROBLEM'
    receivedAt?: string
    receivedBy?: string
    receptionNotes?: string
  }
}

export interface POSOrder {
  _id: string;
  orderNumber: string;
  customerName: string;
  deliveryDate: string;
  deliveryTime?: string;
  products: any[];
  totalValue: number;
  paymentMethod: string;
  status: string;
  posStatus: "NOT_SENT" | "IN_TRANSIT" | "RECEIVED" | "DELIVERED";
  dispatches: any[];
  payments?: { monto: number; forma_cobro: string; fecha: string }[];
  isCredit?: boolean;
  settledInIsland?: boolean;
  isGlobalCourtesy?: boolean;
  globalDiscountPercentage?: number;
  branch?: string;
  salesChannel?: string;
  comments?: string;
}

export interface POSFilters {
  search?: string;
  filterMode?: string;
  date?: string;
  receivedOnly?: boolean;
  receptionStatus?: string | string[];
}

class POSService extends APIBase {
  /**
   * Get orders for a specific branch
   */
  async getIncomingDispatches(branch: string, filters: POSFilters = {}): Promise<POSOrder[]> {
    try {
      let url = `pos/dispatches?branch=${encodeURIComponent(branch)}`
      if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`
      if (filters.filterMode) url += `&filterMode=${encodeURIComponent(filters.filterMode)}`
      if (filters.date) url += `&date=${encodeURIComponent(filters.date)}`

      if (filters.receptionStatus) {
        if (Array.isArray(filters.receptionStatus)) {
          filters.receptionStatus.forEach(s => url += `&receptionStatus=${encodeURIComponent(s)}`)
        } else {
          url += `&receptionStatus=${encodeURIComponent(filters.receptionStatus)}`
        }
      }

      const response = await this.get<{ data: POSOrder[] }>(url)
      return response.data.data
    } catch (error) {
      console.error('Error fetching incoming dispatches:', error)
      throw error
    }
  }

  /**
   * Confirm reception of a dispatch
   */
  async confirmReception(
    orderId: string,
    dispatchId: string,
    data: {
      receivedBy: string;
      receptionNotes?: string;
      items: { productId: string; quantityReceived: number; itemStatus: string }[]
    }
  ): Promise<any> {
    try {
      const response = await this.post(`pos/dispatches/${orderId}/${dispatchId}/confirm`, data)
      return response.data
    } catch (error) {
      console.error('Error confirming reception:', error)
      throw error
    }
  }

  /**
   * Get pickup orders for a branch
   */
  async getPickupOrders(branch: string, filters: POSFilters = {}): Promise<POSOrder[]> {
    try {
      let url = `pos/pickups?branch=${encodeURIComponent(branch)}`
      if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`
      if (filters.filterMode) url += `&filterMode=${encodeURIComponent(filters.filterMode)}`
      if (filters.date) url += `&date=${encodeURIComponent(filters.date)}`
      if (filters.receivedOnly) url += `&receivedOnly=true`

      const response = await this.get<{ data: POSOrder[] }>(url)
      return response.data.data
    } catch (error) {
      console.error('Error fetching pickups:', error)
      throw error
    }
  }

  /**
   * Mark a pickup order as delivered
   */
  async markAsDelivered(orderId: string): Promise<any> {
    try {
      const response = await this.put(`pos/pickups/${orderId}/deliver`, {})
      return response.data
    } catch (error) {
      console.error('Error marking as delivered:', error)
      throw error
    }
  }

  /**
   * Mark an order as settled in a physical island branch
   */
  async settleInIsland(orderId: string, islandName: string): Promise<any> {
    try {
      const response = await this.put(`pos/orders/${orderId}/settle`, { islandName })
      return response.data
    } catch (error) {
      console.error('Error settling in island:', error)
      throw error
    }
  }
}

export default new POSService()
