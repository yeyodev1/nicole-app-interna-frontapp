import { ref, computed } from 'vue'
import ProductionService from '@/services/production.service'
import type { CategoryGroup } from '@/types/production'
import { parseECTDate, getECTNow, isSameDayECT } from '@/utils/dateUtils'

export function useProductionSummary() {
  const isLoading = ref(true)
  const error = ref('')
  const isBackgroundLoading = ref(false)

  // Single source of truth cache
  const rawOrders = ref<any[]>([])
  const rawBucketFilter = ref<'delayed' | 'today' | 'tomorrow' | 'future' | 'all'>('today')
  const sourceFilter = ref<'all' | 'nicole' | 'sucree'>('all')
  const selectedRawProducts = ref<Set<string>>(new Set())

  // History
  const showHistory = ref(false)

  // Category collapse (kept for history panel compatibility)
  const collapsedCategoryIds = ref<Set<string>>(new Set())

  const rawFilteredOrders = computed(() => {
    if (!rawOrders.value.length) return []

    const today = getECTNow()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return rawOrders.value.filter(order => {
      // Source filter (client-side — no API call)
      if (sourceFilter.value !== 'all' && order.contificoSource !== sourceFilter.value) return false

      if (rawBucketFilter.value === 'all') return order.productionStage !== 'VOID'

      if (!order.deliveryDate) return false
      const dDate = parseECTDate(order.deliveryDate)

      if (rawBucketFilter.value === 'today') return isSameDayECT(dDate, today) && order.productionStage !== 'VOID'
      if (rawBucketFilter.value === 'tomorrow') return isSameDayECT(dDate, tomorrow) && order.productionStage !== 'VOID'
      if (rawBucketFilter.value === 'delayed') return dDate < today && order.productionStage !== 'VOID'
      if (rawBucketFilter.value === 'future') {
        const afterTomorrow = new Date(tomorrow)
        afterTomorrow.setDate(afterTomorrow.getDate() + 1)
        afterTomorrow.setHours(0, 0, 0, 0)
        return dDate >= afterTomorrow && order.productionStage !== 'VOID'
      }
      return false
    })
  })

  const rawStatsByDestination = computed(() => {
    const stats: Record<string, Record<string, number>> = {}
    if (!rawFilteredOrders.value.length) return stats

    rawFilteredOrders.value.forEach(order => {
      let dest = 'Otros / Sin Local'
      if (order.deliveryType === 'delivery') {
        dest = 'Delivery'
      } else if (order.branch) {
        const b = order.branch.toLowerCase()
        if (b.includes('marino')) dest = 'San Marino'
        else if (b.includes('mall') || b.includes('sol')) dest = 'Mall del Sol'
        else if (b.includes('centro') || b.includes('producci')) dest = 'Centro Prod.'
        else dest = order.branch
      }

      if (!stats[dest]) stats[dest] = {}
      const destGroup = stats[dest] as Record<string, number>

      order.products.forEach((p: any) => {
        destGroup[p.name] = (destGroup[p.name] || 0) + (p.quantity || 0)
      })
    })

    return stats
  })

  // ── Category mapping helper ─────────────────────────────────────────
  const mapCategory = (productName: string, rawCategory?: string): string => {
    if (rawCategory) {
      const c = rawCategory.toUpperCase()
      if (c.includes('ENTERO') || c.includes('TORTA'))               return 'TORTAS'
      if (c.includes('PORCION') || c.includes('PORCIÓN'))            return 'TORTAS PORCIÓN'
      if (c.includes('INDIVIDUAL') || c.includes('JOYITA'))          return 'JOYITAS'
      if (c.includes('PANADER') || c.includes('BOLLERÍA') || c.includes('BOLLERIA')) return 'BOLLERÍA'
      if (c.includes('GALLETA') || c.includes('COOKIE') || c.includes('GALLAT'))     return 'GALLETERÍA'
      if (c.includes('SIROPE') || c.includes('SYRUP'))               return 'SIROPES'
      if (c.includes('VEGETAL') || c.includes('FRUTA'))              return 'VEGETALES'
      if (c.includes('HELAD') || c.includes('GIANDUJA'))             return 'HELADERÍA'
    }
    const n = productName.toUpperCase()
    if (n.includes('TORTA') || n.includes('CAKE'))                           return 'TORTAS'
    if (n.includes('PORCION') || n.includes('PORCIÓN'))                      return 'TORTAS PORCIÓN'
    if (n.includes('JOYITA') || n.includes('MINI CAKE'))                     return 'JOYITAS'
    if (n.includes('BRIOCHE') || n.includes('CROISSANT') || n.includes('ROLL') || n.includes('PAN SUIZO') || n.includes('PLUM')) return 'BOLLERÍA'
    if (n.includes('COOKIE') || n.includes('GALLETA') || n.includes('BIZCOCHO') || n.includes('BROWNIE')) return 'GALLETERÍA'
    if (n.includes('SIROPE') || n.includes('POLVO CHAI') || n.includes('MATCHA')) return 'SIROPES'
    if (n.includes('FRUTILLA') || n.includes('ARANDANO') || n.includes('FRAMBUESA') || n.includes('VEGETAL')) return 'VEGETALES'
    if (n.includes('HELADO') || n.includes('GIANDUJA') || n.includes('CRUMBLE') || n.includes('MARSHMALLOW')) return 'HELADERÍA'
    if (n.includes('MASA') || n.includes('ROAST') || n.includes('CAPRESSE') || n.includes('MEDITERRANEO')) return 'CASA MIA'
    return 'OTROS'
  }

  const CATEGORY_ORDER = ['TORTAS', 'TORTAS PORCIÓN', 'JOYITAS', 'BOLLERÍA', 'GALLETERÍA', 'SIROPES', 'VEGETALES', 'HELADERÍA', 'CASA MIA', 'OTROS']

  // Groups by Destination → Round Label → Category → Product → Quantity
  const rawStatsByDestRoundCategory = computed(() => {
    const stats: Record<string, Record<string, Record<string, Record<string, number>>>> = {}
    if (!rawFilteredOrders.value.length) return stats

    rawFilteredOrders.value.forEach(order => {
      let dest = 'Otros / Sin Local'
      if (order.deliveryType === 'delivery') {
        dest = 'Delivery'
      } else if (order.branch) {
        const b = order.branch.toLowerCase()
        if (b.includes('marino')) dest = 'San Marino'
        else if (b.includes('mall') || b.includes('sol')) dest = 'Mall del Sol'
        else if (b.includes('centro') || b.includes('producci')) dest = 'Centro Prod.'
        else dest = order.branch
      }

      const isRestock = order.salesChannel === 'Restock' || order.salesChannel === 'Restock-Bodega'
      const roundLabel = isRestock && order.comments ? order.comments : ''

      if (!stats[dest]) stats[dest] = {}
      if (!stats[dest]![roundLabel]) stats[dest]![roundLabel] = {}

      order.products.forEach((p: any) => {
        const cat = mapCategory(p.name, p.category)
        if (!stats[dest]![roundLabel]![cat]) stats[dest]![roundLabel]![cat] = {}
        const catGroup = stats[dest]![roundLabel]![cat] as Record<string, number>
        catGroup[p.name] = (catGroup[p.name] || 0) + (p.quantity || 0)
      })
    })

    // Sort categories within each round
    const sorted: typeof stats = {}
    Object.entries(stats).forEach(([dest, rounds]) => {
      sorted[dest] = {}
      Object.entries(rounds).forEach(([round, cats]) => {
        const sortedCats: Record<string, Record<string, number>> = {}
        Object.keys(cats)
          .sort((a, b) => {
            const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b)
            if (ia !== -1 && ib !== -1) return ia - ib
            if (ia !== -1) return -1; if (ib !== -1) return 1
            return a.localeCompare(b)
          })
          .forEach(cat => { sortedCats[cat] = cats[cat]! })
        sorted[dest]![round] = sortedCats
      })
    })

    return sorted
  })

  // Collapsed state for category sections in the raw view
  const collapsedProductCategories = ref<Set<string>>(new Set())

  const toggleProductCategory = (key: string) => {
    if (collapsedProductCategories.value.has(key)) {
      collapsedProductCategories.value.delete(key)
    } else {
      collapsedProductCategories.value.add(key)
    }
  }

  // Groups by Destination → Round Label → Product → Quantity
  const rawStatsByDestinationAndRound = computed(() => {
    const stats: Record<string, Record<string, Record<string, number>>> = {}
    if (!rawFilteredOrders.value.length) return stats

    rawFilteredOrders.value.forEach(order => {
      let dest = 'Otros / Sin Local'
      if (order.deliveryType === 'delivery') {
        dest = 'Delivery'
      } else if (order.branch) {
        const b = order.branch.toLowerCase()
        if (b.includes('marino')) dest = 'San Marino'
        else if (b.includes('mall') || b.includes('sol')) dest = 'Mall del Sol'
        else if (b.includes('centro') || b.includes('producci')) dest = 'Centro Prod.'
        else dest = order.branch
      }

      const isRestock = order.salesChannel === 'Restock' || order.salesChannel === 'Restock-Bodega'
      const roundLabel = isRestock && order.comments ? order.comments : ''

      if (!stats[dest]) stats[dest] = {}
      if (!stats[dest]![roundLabel]) stats[dest]![roundLabel] = {}
      const roundGroup = stats[dest]![roundLabel] as Record<string, number>

      order.products.forEach((p: any) => {
        roundGroup[p.name] = (roundGroup[p.name] || 0) + (p.quantity || 0)
      })
    })

    return stats
  })

  // Total pending quantity per product across filtered orders
  const totalByProduct = computed(() => {
    const totals: Record<string, number> = {}
    rawFilteredOrders.value.forEach(order => {
      order.products.forEach((p: any) => {
        if (p.productionStatus !== 'COMPLETED') {
          const pending = p.quantity - (p.produced || 0)
          if (pending > 0) totals[p.name] = (totals[p.name] || 0) + pending
        }
      })
    })
    return totals
  })

  const fetchSummary = async (background = false) => {
    try {
      if (!background) isLoading.value = true
      error.value = ''
      rawOrders.value = await ProductionService.getAllOrders('all')
      if (!background) isLoading.value = false
    } catch (err) {
      console.error(err)
      error.value = 'No se pudo cargar el resumen de producción.'
    } finally {
      if (!background) isLoading.value = false
      isBackgroundLoading.value = false
    }
  }

  const toggleRawProductSelection = (productName: string) => {
    if (selectedRawProducts.value.has(productName)) {
      selectedRawProducts.value.delete(productName)
    } else {
      selectedRawProducts.value.add(productName)
    }
  }

  const clearRawSelection = () => {
    selectedRawProducts.value.clear()
  }

  const isBatchProcessing = ref(false)

  // Cantidad a producir por producto en el modal de confirmación.
  // Por defecto todo lo pendiente; la cocina puede bajarlo (piden 100, hará 20).
  const batchQuantities = ref<Record<string, number>>({})

  const prepareBatchQuantities = () => {
    const next: Record<string, number> = {}
    for (const name of selectedRawProducts.value) {
      next[name] = totalByProduct.value[name] || 0
    }
    batchQuantities.value = next
  }

  const setBatchQuantity = (name: string, qty: number) => {
    const max = totalByProduct.value[name] || 0
    batchQuantities.value[name] = Math.max(0, Math.min(max, Math.round(qty)))
  }

  const batchCompleteSelected = async () => {
    if (selectedRawProducts.value.size === 0) return
    const items = Array.from(selectedRawProducts.value)
      .map(name => ({
        productName: name,
        quantity: batchQuantities.value[name] ?? (totalByProduct.value[name] || 0),
      }))
      .filter(i => i.quantity > 0)
    if (items.length === 0) return
    try {
      isBatchProcessing.value = true
      await ProductionService.batchRegisterProgress(items)
      clearRawSelection()
      await fetchSummary(true)
    } finally {
      isBatchProcessing.value = false
    }
  }

  // Kept for history panel / other potential callers
  const toggleCategory = (categoryGroup: CategoryGroup) => {
    if (collapsedCategoryIds.value.has(categoryGroup.id)) {
      collapsedCategoryIds.value.delete(categoryGroup.id)
    } else {
      collapsedCategoryIds.value.add(categoryGroup.id)
    }
  }

  const toggleExpand = (item: any) => {
    item.isExpanded = !item.isExpanded
  }

  const voidItem = async (item: any) => {
    try {
      const voidPromises = item.orders.map((o: any) => ProductionService.voidOrder(o.id))
      await Promise.all(voidPromises)
    } catch (err) {
      console.error(err)
      error.value = 'Error al anular item'
      throw err
    }
  }

  return {
    isLoading,
    isBackgroundLoading,
    error,
    showHistory,
    fetchSummary,
    // Raw mode (now the only mode)
    rawOrders,
    rawBucketFilter,
    sourceFilter,
    rawFilteredOrders,
    rawStatsByDestination,
    rawStatsByDestinationAndRound,
    rawStatsByDestRoundCategory,
    collapsedProductCategories,
    toggleProductCategory,
    selectedRawProducts,
    toggleRawProductSelection,
    clearRawSelection,
    batchCompleteSelected,
    batchQuantities,
    prepareBatchQuantities,
    setBatchQuantity,
    isBatchProcessing,
    totalByProduct,
    // Secondary (history panel / compatibility)
    collapsedCategoryIds,
    toggleCategory,
    toggleExpand,
    voidItem,
  }
}
