import APIBase from './httpBase'
import type { Order } from '@/types/order'

export interface ProductionTask extends Order { }

class ProductionService extends APIBase {
  async getTasks(): Promise<ProductionTask[]> {
    try {
      const response = await this.get<{ data: ProductionTask[] }>('production')
      return response.data.data
    } catch (error) {
      console.error('Error fetching production tasks:', error)
      throw error
    }
  }

  async getAllOrders(date?: string, source?: 'nicole' | 'sucree'): Promise<ProductionTask[]> {
    try {
      const params = new URLSearchParams()
      if (date) params.set('date', date)
      if (source) params.set('source', source)
      const query = params.toString() ? `?${params.toString()}` : ''
      const response = await this.get<{ data: ProductionTask[] }>(`production/all-orders${query}`)
      return response.data.data
    } catch (error) {
      console.error('Error fetching all orders:', error)
      throw error
    }
  }

  async registerDispatch(orderId: string, payload: any): Promise<any> {
    try {
      const response = await this.post(`production/${orderId}/dispatch`, payload)
      return response.data
    } catch (error) {
      console.error('Error registering dispatch:', error)
      throw error
    }
  }

  async updateDispatch(orderId: string, dispatchId: string, payload: any): Promise<any> {
    try {
      const response = await this.put(`production/${orderId}/dispatch/${dispatchId}`, payload)
      return response.data
    } catch (error) {
      console.error('Error updating dispatch:', error)
      throw error
    }
  }

  async getReports(range: 'today' | 'week'): Promise<any> {
    try {
      const response = await this.get<{ data: any }>(`production/reports?range=${range}`)
      return response.data.data
    } catch (error) {
      console.error('Error fetching reports:', error)
      throw error
    }
  }

  async registerBatchDispatch(ids: string[]): Promise<any> {
    try {
      const response = await this.post('production/dispatch/batch', { ids })
      return response.data
    } catch (error) {
      console.error('Error in batch dispatch:', error)
      throw error
    }
  }

  async registerDispatchProgress(destination: string, items: { name: string; quantity: number }[]): Promise<any> {
    try {
      const response = await this.post('production/dispatch/progress', { destination, items })
      return response.data
    } catch (error) {
      console.error('Error in dispatch progress:', error)
      throw error
    }
  }

  async updateTask(id: string, updates: { stage?: 'PENDING' | 'IN_PROCESS' | 'FINISHED'; notes?: string }): Promise<ProductionTask> {
    try {
      const response = await this.patch<{ data: ProductionTask }>(`production/${id}`, updates)
      return response.data.data
    } catch (error) {
      console.error('Error updating production task:', error)
      throw error
    }
  }

  async batchUpdate(ids: string[], stage: 'PENDING' | 'IN_PROCESS' | 'FINISHED') {
    await this.patch('production/batch', { ids, stage })
  }

  async registerProgress(productName: string, quantity: number) {
    await this.post('production/progress', { productName, quantity })
  }

  async batchRegisterProgress(items: { productName: string; quantity: number; orderIds?: string[] }[]) {
    const response = await this.post<any>('production/progress/batch', { items })
    return (response.data as any)?.data || []
  }

  async getSummary(bucket?: 'delayed' | 'today' | 'tomorrow' | 'future', source?: 'nicole' | 'sucree'): Promise<any> {
    const params = new URLSearchParams()
    if (bucket) params.set('bucket', bucket)
    if (source) params.set('source', source)
    const query = params.toString() ? `?${params.toString()}` : ''
    const response = await this.get<{ dashboard: any }>(`production/summary${query}`)
    return response.data.dashboard
  }

  async updateItemStatus(orderId: string, productName: string, status: string, notes?: string) {
    const response = await this.patch(`production/${orderId}/product-status`, { productName, status, notes })
    return response.data
  }

  async voidOrder(orderId: string) {
    const response = await this.patch(`production/${orderId}/void`, {})
    return response.data
  }

  async revertOrder(orderId: string) {
    const response = await this.patch(`production/${orderId}/revert`, {})
    return response.data
  }

  async restoreOrder(orderId: string) {
    const response = await this.patch(`production/${orderId}/restore`, {})
    return response.data
  }

  async returnOrder(orderId: string, notes: string) {
    const response = await this.put(`production/${orderId}/return`, { notes, reportedBy: 'Producción' })
    return response.data
  }
}

export default new ProductionService()
