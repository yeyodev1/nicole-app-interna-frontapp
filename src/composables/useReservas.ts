import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import OrderService from '@/services/order.service'
import { canDiscard, type ReservaCounts, type ReservaFilter } from '@/utils/reserva'

export type ReservaBrand = 'all' | 'nicole' | 'sucree'

const SEARCH_DELAY_MS = 400

/** Estado del panel de reservas: filtros, lista, contadores y selección. */
export function useReservas() {
  const filter = shallowRef<ReservaFilter>('pending')
  const brand = shallowRef<ReservaBrand>('all')
  const search = shallowRef('')
  const orders = ref<any[]>([])
  const counts = ref<ReservaCounts>({ pending: 0, contacted: 0, managed: 0, discarded: 0, all: 0 })
  const reminderStats = ref({ returned: 0, recoveredTotal: 0 })
  const limit = shallowRef(0)
  const isLoading = shallowRef(false)
  const loadFailed = shallowRef(false)
  const selectedIds = shallowRef<Set<string>>(new Set())

  // Solo la última respuesta cuenta: cambiar rápido de filtro no pinta datos viejos.
  let lastRequest = 0

  async function fetchReservas() {
    const request = ++lastRequest
    isLoading.value = true
    try {
      const data = await OrderService.getReservas({
        state: filter.value,
        ...(brand.value !== 'all' ? { brand: brand.value } : {}),
        ...(search.value.trim() ? { search: search.value.trim() } : {})
      })
      if (request !== lastRequest) return
      orders.value = data.orders
      counts.value = data.counts
      reminderStats.value = data.reminders
      limit.value = data.limit
      loadFailed.value = false
      keepVisibleSelection()
    } catch {
      if (request === lastRequest) loadFailed.value = true
    } finally {
      if (request === lastRequest) isLoading.value = false
    }
  }

  const discardable = computed(() => orders.value.filter(canDiscard))
  const allSelected = computed(() =>
    discardable.value.length > 0 && discardable.value.every(order => selectedIds.value.has(order._id))
  )
  const selectedOrders = computed(() => orders.value.filter(order => selectedIds.value.has(order._id)))
  const isTruncated = computed(() => limit.value > 0 && orders.value.length >= limit.value)

  function keepVisibleSelection() {
    const visible = new Set(discardable.value.map(order => order._id))
    selectedIds.value = new Set([...selectedIds.value].filter(id => visible.has(id)))
  }

  function toggleSelected(id: string) {
    const next = new Set(selectedIds.value)
    if (!next.delete(id)) next.add(id)
    selectedIds.value = next
  }

  function toggleAll() {
    selectedIds.value = allSelected.value ? new Set() : new Set(discardable.value.map(order => order._id))
  }

  function clearSelection() {
    selectedIds.value = new Set()
  }

  watch([filter, brand], () => {
    clearSelection()
    fetchReservas()
  }, { immediate: true })

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  watch(search, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(fetchReservas, SEARCH_DELAY_MS)
  })
  onScopeDispose(() => clearTimeout(searchTimer))

  return {
    filter,
    brand,
    search,
    orders,
    counts,
    reminderStats,
    limit,
    isLoading,
    loadFailed,
    isTruncated,
    selectedIds,
    selectedOrders,
    discardable,
    allSelected,
    fetchReservas,
    toggleSelected,
    toggleAll,
    clearSelection
  }
}
