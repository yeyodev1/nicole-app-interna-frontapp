import APIBase from './httpBase'
import type { AxiosResponse } from 'axios'
import type { Product } from '@/types/order'

// Mapa nombre normalizado → categoría tal cual Contífico (caché 5 min)
let categoryMapCache: { at: number; byName: Record<string, string> } | null = null
const CATEGORY_MAP_TTL = 5 * 60 * 1000

class ProductService extends APIBase {
  async getProducts(params: { filtro?: string; page?: number; limit?: number } = {}): Promise<Product[]> {
    try {
      const response = await this.get<Product[]>('products', undefined, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching products:', error)
      throw error
    }
  }

  /**
   * Categoría de cada producto tal cual Contífico, por nombre normalizado.
   * Devuelve {} si Contífico falla: los consumidores usan su fallback.
   */
  async getContificoCategoryMap(): Promise<Record<string, string>> {
    if (categoryMapCache && Date.now() - categoryMapCache.at < CATEGORY_MAP_TTL) {
      return categoryMapCache.byName
    }
    try {
      const response = await this.get<{ byName: Record<string, string> }>('products/category-map')
      const byName = response.data?.byName || {}
      categoryMapCache = { at: Date.now(), byName }
      return byName
    } catch (error) {
      console.error('Error fetching category map:', error)
      return {}
    }
  }
}

export default new ProductService()
