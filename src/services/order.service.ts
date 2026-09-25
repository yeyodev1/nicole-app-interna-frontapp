import APIBase from './httpBase'

interface OrderData {
  customerName: string
  customerPhone: string
  deliveryDate: string
  deliveryTime: string
  deliveryType: 'pickup' | 'delivery' | 'retiro'
  branch?: string
  googleMapsLink?: string
  deliveryAddress?: string
  products: Array<{
    id?: string
    contifico_id?: string
    name: string
    quantity: number
    price: number
  }>
  invoiceData?: {
    ruc: string
    businessName: string
    email: string
    address: string
  }
  invoiceNeeded: boolean
  comments?: string
  responsible: string
  salesChannel: string
  paymentMethod: string
  skipProduction?: boolean
  exitPoint?: string
  productionStage?: 'PENDING' | 'IN_PROCESS' | 'FINISHED' | 'VOID'
}

interface OrderResponse {
  message: string
  order: any
  whatsappMessage: string
}

class OrderService extends APIBase {
  async createOrder(data: OrderData): Promise<OrderResponse> {
    try {
      const response = await this.post<OrderResponse>('orders', data)
      return response.data
    } catch (error) {
      console.error('Error creating order:', error)
      throw error
    }
  }

  async getOrders(filters?: { search?: string, startDate?: string, endDate?: string, dateType?: 'deliveryDate' | 'createdAt', dispatchStatus?: string, webPending?: 'true', salesChannel?: string }): Promise<any[]> {
    try {
      const response = await this.get<any[]>('orders', undefined, { params: filters })
      return response.data
    } catch (error) {
      console.error('Error fetching orders:', error)
      throw error
    }
  }

  /**
   * Pedido web por transferencia: registra el cobro TRA con el comprobante y deja la
   * factura en cola; con invoiceNow la emite en el momento (Contífico + SRI).
   */
  async confirmWebTransfer(
    id: string,
    body: { invoiceNow?: boolean; withoutProof?: boolean; reference?: string } = {}
  ): Promise<{ message: string; invoiced?: boolean; order: any }> {
    const response = await this.post<any>(`orders/${id}/web-transfer/confirm`, body)
    return response.data
  }

  /** Rechaza el comprobante del pedido web: la tienda le pide otro al cliente. */
  async rejectWebTransferProof(id: string, reason: string): Promise<{ message: string; order: any }> {
    const response = await this.post<any>(`orders/${id}/web-transfer/reject-proof`, { reason })
    return response.data
  }

  /** Pedido de la tienda online → status GESTIONADO. */
  async markWebOrderManaged(id: string): Promise<any> {
    try {
      const response = await this.patch<any>(`orders/${id}/web-managed`, {})
      return response.data
    } catch (error) {
      console.error('Error marking web order as managed:', error)
      throw error
    }
  }

  async getOrder(id: string): Promise<any> {
    try {
      const response = await this.get<any>(`orders/${id}`)
      return response.data
    } catch (error) {
      console.error('Error fetching order:', error)
      throw error
    }
  }
  async updateInvoiceData(id: string, data: { invoiceNeeded: boolean, invoiceData?: any }): Promise<any> {
    try {
      const response = await this.put<any>(`orders/${id}/invoice`, data)
      return response.data
    } catch (error) {
      console.error('Error updating invoice data:', error)
      throw error
    }
  }

  async registerCollection(id: string, data: any): Promise<any> {
    try {
      const response = await this.post<any>(`orders/${id}/collection`, data)
      return response.data
    } catch (error) {
      console.error('Error registering collection:', error)
      throw error
    }
  }

  async generateInvoice(id: string): Promise<any> {
    try {
      const response = await this.post<any>(`orders/${id}/invoice/generate`, {})
      return response.data
    } catch (error) {
      console.error('Error generating invoice:', error)
      throw error
    }
  }

  async regenerateInvoice(id: string): Promise<any> {
    try {
      const response = await this.post<any>(`orders/${id}/invoice/regenerate`, {})
      return response.data
    } catch (error) {
      console.error('Error regenerating invoice:', error)
      throw error
    }
  }

  async regenerateInvoiceConsumidorFinal(id: string): Promise<any> {
    try {
      const response = await this.post<any>(`orders/${id}/invoice/regenerate?force=true`, {
        invoiceDataOverride: {
          ruc: '9999999999',
          businessName: 'sin nombre',
          email: 'noname@noname.com',
          address: 'sin dirección',
        },
      })
      return response.data
    } catch (error) {
      console.error('Error regenerating invoice (consumidor final):', error)
      throw error
    }
  }

  async getInvoicePdf(id: string): Promise<any> {
    try {
      const response = await this.get<any>(`orders/${id}/invoice-pdf`)
      return response.data
    } catch (error) {
      console.error('Error fetching invoice PDF:', error)
      throw error
    }
  }

  async settleOrderInIsland(id: string, islandName: string): Promise<any> {
    try {
      const response = await this.post<any>(`orders/${id}/settle-island`, { islandName })
      return response.data
    } catch (error) {
      console.error('Error settling order in island:', error)
      throw error
    }
  }

  async updateOrder(id: string, data: any): Promise<any> {
    try {
      const response = await this.put<any>(`orders/${id}`, data)
      return response.data
    } catch (error) {
      console.error('Error updating order:', error)
      throw error
    }
  }

  async bulkAssign(orderIds: string[], deliveryPerson: any): Promise<any> {
    try {
      const response = await this.post<any>('orders/bulk-assign', { orderIds, deliveryPerson })
      return response.data
    } catch (error) {
      console.error('Error bulk assigning orders:', error)
      throw error
    }
  }

  async reassignDelivery(oldPersonId: string, newPerson: any): Promise<any> {
    try {
      const response = await this.post<any>('orders/reassign-delivery', { oldPersonId, newPerson })
      return response.data
    } catch (error) {
      console.error('Error reassigning delivery:', error)
      throw error
    }
  }

  async deleteOrder(id: string): Promise<any> {
    try {
      const response = await this.delete<any>(`orders/${id}`)
      return response.data
    } catch (error) {
      console.error('Error deleting order:', error)
      throw error
    }
  }

  async returnOrder(id: string, notes: string): Promise<any> {
    try {
      const response = await this.put<any>(`orders/${id}/return`, { notes })
      return response.data
    } catch (error) {
      console.error('Error returning order:', error)
      throw error
    }
  }

  async getInvoiceStatus(): Promise<{
    pending: number
    error: number
    processed: number
    errorOrders?: Array<{ _id: string; customerName: string; invoiceError?: string; invoiceData?: any; deliveryDate?: string }>
  }> {
    try {
      const response = await this.get<any>('orders/invoice-status')
      return response.data
    } catch (error) {
      console.error('Error fetching invoice status:', error)
      throw error
    }
  }

  async getInvoiceAuthStatus(id: string): Promise<{ documento_id: string; tipo_registro: string; tipo_documento: string; estado: string }> {
    try {
      const response = await this.get<any>(`orders/${id}/invoice/auth-status`)
      return response.data
    } catch (error) {
      console.error('Error fetching invoice auth status:', error)
      throw error
    }
  }

  async triggerInvoiceAuth(id: string): Promise<any> {
    try {
      const response = await this.post<any>(`orders/${id}/invoice/authorize`, {})
      return response.data
    } catch (error) {
      console.error('Error triggering invoice auth:', error)
      throw error
    }
  }

  async triggerBatchInvoice(): Promise<{ remaining: number; results: { processed: number; failed: number } }> {
    try {
      const response = await this.post<any>('orders/batch-invoice', {})
      return response.data
    } catch (error) {
      console.error('Error triggering batch invoice:', error)
      throw error
    }
  }

  async syncInvoiceAuthorizations(): Promise<{
    found: number
    authorized: number
    sentToSri: number
    stillPending: number
    failed: number
    details: Array<{ orderId: string; customerName: string; action: string; autorizacion?: string }>
  }> {
    try {
      const response = await this.post<any>('orders/invoice/sync-authorizations', {})
      return response.data
    } catch (error) {
      console.error('Error syncing authorizations:', error)
      throw error
    }
  }

  async batchReauthorizeInvoices(): Promise<{
    found: number
    sentToSri: number
    regenerated: number
    skipped: number
    failed: number
    results: Array<{ orderId: string; customerName: string; action: string; detail?: string }>
  }> {
    try {
      const response = await this.post<any>('orders/invoice/batch-reauthorize', {})
      return response.data
    } catch (error) {
      console.error('Error triggering batch reauthorize:', error)
      throw error
    }
  }

  async searchPersona(identificacion: string): Promise<{ razon_social: string; email: string; direccion: string } | null> {
    try {
      const response = await this.get<any>(`persons?identificacion=${identificacion}`)
      const persona = response.data?.data?.[0]
      return persona ?? null
    } catch {
      return null
    }
  }
}

export default new OrderService()
