import { ref, computed } from 'vue'
import ProductionService from '@/services/production.service'
import productService from '@/services/product.service'
import type { CategoryGroup } from '@/types/production'
import { parseECTDate, getECTNow, isSameDayECT } from '@/utils/dateUtils'

const normName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

/** Celda de producto en el resumen: lo pedido y lo que falta por producir. */
export interface ProductCell { qty: number; pending: number }

/** Fila seleccionable del resumen (producto dentro de un destino/ronda). */
export interface ProductRowMeta {
  key: string
  name: string
  destination: string
  round: string
  qty: number
  pending: number
  orderIds: string[]
}

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

  // Solo el filtro de fecha (bucket): la base para los contadores Nicole/Sucree
  const bucketFilteredOrders = computed(() => {
    if (!rawOrders.value.length) return []

    const today = getECTNow()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return rawOrders.value.filter(order => {
      if (order.productionStage === 'VOID') return false
      if (rawBucketFilter.value === 'all') return true

      if (!order.deliveryDate) return false
      const dDate = parseECTDate(order.deliveryDate)

      if (rawBucketFilter.value === 'today') return isSameDayECT(dDate, today)
      if (rawBucketFilter.value === 'tomorrow') return isSameDayECT(dDate, tomorrow)
      if (rawBucketFilter.value === 'delayed') return dDate < today
      if (rawBucketFilter.value === 'future') {
        const afterTomorrow = new Date(tomorrow)
        afterTomorrow.setDate(afterTomorrow.getDate() + 1)
        afterTomorrow.setHours(0, 0, 0, 0)
        return dDate >= afterTomorrow
      }
      return false
    })
  })

  const rawFilteredOrders = computed(() =>
    sourceFilter.value === 'all'
      ? bucketFilteredOrders.value
      : bucketFilteredOrders.value.filter(o => o.contificoSource === sourceFilter.value)
  )

  // Cuántos pedidos hay de cada marca en el periodo elegido (para las píldoras)
  const sourceCounts = computed(() => {
    const counts = { all: bucketFilteredOrders.value.length, nicole: 0, sucree: 0 }
    for (const o of bucketFilteredOrders.value) {
      if (o.contificoSource === 'sucree') counts.sucree++
      else counts.nicole++
    }
    return counts
  })

  // ── Destino / ronda de una orden ────────────────────────────────────
  const destOf = (order: any): string => {
    if (order.deliveryType === 'delivery') return 'Delivery'
    if (order.branch) {
      const b = order.branch.toLowerCase()
      if (b.includes('marino')) return 'San Marino'
      if (b.includes('mall') || b.includes('sol')) return 'Mall del Sol'
      if (b.includes('centro') || b.includes('producci')) return 'Centro Prod.'
      return order.branch
    }
    return 'Otros / Sin Local'
  }

  const roundOf = (order: any): string => {
    const isRestock = order.salesChannel === 'Restock' || order.salesChannel === 'Restock-Bodega'
    return isRestock && order.comments ? order.comments : ''
  }

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

  // Categorías tal cual Contífico (nombre normalizado → categoría)
  const contificoCatByName = ref<Record<string, string>>({})

  const categoryOf = (productName: string, rawCategory?: string): string =>
    contificoCatByName.value[normName(productName)] || mapCategory(productName, rawCategory)

  // Groups by Destination → Round Label → Category → Product → { qty, pending }
  // y metadatos por fila (clave dest|||ronda|||producto): pendiente real y los
  // ids de las órdenes de esa fila, para acreditar la producción donde se marcó.
  const destRoundData = computed(() => {
    const stats: Record<string, Record<string, Record<string, Record<string, ProductCell>>>> = {}
    const meta = new Map<string, ProductRowMeta>()
    if (!rawFilteredOrders.value.length) return { stats, meta }

    rawFilteredOrders.value.forEach(order => {
      const dest = destOf(order)
      const roundLabel = roundOf(order)
      const orderId = String(order.id || order._id || '')

      if (!stats[dest]) stats[dest] = {}
      if (!stats[dest]![roundLabel]) stats[dest]![roundLabel] = {}

      order.products.forEach((p: any) => {
        const cat = categoryOf(p.name, p.category)
        if (!stats[dest]![roundLabel]![cat]) stats[dest]![roundLabel]![cat] = {}
        const catGroup = stats[dest]![roundLabel]![cat] as Record<string, ProductCell>
        const qty = p.quantity || 0
        const pending = p.productionStatus !== 'COMPLETED'
          ? Math.max(0, qty - (p.produced || 0))
          : 0

        if (!catGroup[p.name]) catGroup[p.name] = { qty: 0, pending: 0 }
        catGroup[p.name]!.qty += qty
        catGroup[p.name]!.pending += pending

        const key = `${dest}|||${roundLabel}|||${p.name}`
        let row = meta.get(key)
        if (!row) {
          row = { key, name: p.name, destination: dest, round: roundLabel, qty: 0, pending: 0, orderIds: [] }
          meta.set(key, row)
        }
        row.qty += qty
        row.pending += pending
        if (orderId && !row.orderIds.includes(orderId)) row.orderIds.push(orderId)
      })
    })

    // Sort categories within each round
    const sorted: typeof stats = {}
    Object.entries(stats).forEach(([dest, rounds]) => {
      sorted[dest] = {}
      Object.entries(rounds).forEach(([round, cats]) => {
        const sortedCats: Record<string, Record<string, ProductCell>> = {}
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

    return { stats: sorted, meta }
  })

  const rawStatsByDestRoundCategory = computed(() => destRoundData.value.stats)
  const rowMeta = computed(() => destRoundData.value.meta)

  // Collapsed state for category sections in the raw view
  const collapsedProductCategories = ref<Set<string>>(new Set())

  const toggleProductCategory = (key: string) => {
    if (collapsedProductCategories.value.has(key)) {
      collapsedProductCategories.value.delete(key)
    } else {
      collapsedProductCategories.value.add(key)
    }
  }

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
      // El mapa de categorías de Contífico se carga en paralelo, sin bloquear
      productService.getContificoCategoryMap().then(map => { contificoCatByName.value = map })
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

  // La selección es por FILA (destino|||ronda|||producto): marcar un producto en
  // un destino no marca el del mismo nombre en otro. Filas sin pendiente no se
  // seleccionan (ya está todo producido ahí).
  const toggleRawProductSelection = (rowKey: string) => {
    if (selectedRawProducts.value.has(rowKey)) {
      selectedRawProducts.value.delete(rowKey)
    } else {
      const row = rowMeta.value.get(rowKey)
      if (!row || row.pending <= 0) return
      selectedRawProducts.value.add(rowKey)
    }
  }

  // Filas seleccionadas con sus metadatos (para el modal y el envío)
  const selectedRows = computed<ProductRowMeta[]>(() =>
    Array.from(selectedRawProducts.value)
      .map(key => rowMeta.value.get(key))
      .filter((r): r is ProductRowMeta => !!r)
  )

  // Nombres únicos de producto de la selección (para las exportaciones)
  const selectedProductNames = computed(() =>
    Array.from(new Set(selectedRows.value.map(r => r.name)))
  )

  const clearRawSelection = () => {
    selectedRawProducts.value.clear()
  }

  const isBatchProcessing = ref(false)

  // Cantidad a producir por fila en el modal de confirmación.
  // Por defecto todo lo pendiente; la cocina puede bajarlo (piden 100, hará 20).
  const batchQuantities = ref<Record<string, number>>({})

  const prepareBatchQuantities = () => {
    const next: Record<string, number> = {}
    for (const row of selectedRows.value) {
      next[row.key] = row.pending
    }
    batchQuantities.value = next
  }

  const setBatchQuantity = (rowKey: string, qty: number) => {
    const max = rowMeta.value.get(rowKey)?.pending || 0
    batchQuantities.value[rowKey] = Math.max(0, Math.min(max, Math.round(qty)))
  }

  // Envía la producción. Devuelve cuántas unidades se registraron y los fallos,
  // para que la vista avise claramente (antes fallaba en silencio).
  const batchCompleteSelected = async (): Promise<{ sent: number; failures: string[] }> => {
    const items = selectedRows.value
      .map(row => ({
        productName: row.name,
        quantity: batchQuantities.value[row.key] ?? row.pending,
        orderIds: row.orderIds,
      }))
      .filter(i => i.quantity > 0)
    if (items.length === 0) return { sent: 0, failures: [] }
    try {
      isBatchProcessing.value = true
      const results = await ProductionService.batchRegisterProgress(items)
      const failures = (results || [])
        .filter((r: any) => !r.success)
        .map((r: any) => r.name)
      clearRawSelection()
      await fetchSummary(true)
      return { sent: items.reduce((s, i) => s + i.quantity, 0), failures }
    } finally {
      isBatchProcessing.value = false
    }
  }

  // Pedidos para exportar la Orden de Producción/Entrega: por fecha y sucursal,
  // independiente de las píldoras de arriba. date: 'all' | 'YYYY-MM-DD'.
  const filterOrdersForExport = (opts: { date: string; destination: string }) => {
    return rawOrders.value.filter(order => {
      if (order.productionStage === 'VOID') return false
      if (opts.date !== 'all') {
        if (!order.deliveryDate) return false
        if (!isSameDayECT(parseECTDate(order.deliveryDate), parseECTDate(opts.date))) return false
      }
      if (opts.destination !== 'all' && destOf(order) !== opts.destination) return false
      return true
    })
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
    rawStatsByDestRoundCategory,
    rowMeta,
    selectedRows,
    selectedProductNames,
    sourceCounts,
    filterOrdersForExport,
    contificoCatByName,
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
