import { ref, watch, computed } from 'vue'
import OrderService from '@/services/order.service'
import { getECTTodayString, getECTNow } from '@/utils/dateUtils'
import { useToast } from '@/composables/useToast'

export type FilterMode = 'today' | 'yesterday' | 'tomorrow' | 'all' | 'custom' | 'invoiceError' | 'unbilled' | 'returns' | 'webPending'
export type DateType = 'deliveryDate' | 'createdAt'

export function useOrderFilters() {
  const { error: showError } = useToast()

  const orders = ref<any[]>([])
  const isLoading = ref(false)

  // Filter State
  const filterMode = ref<FilterMode>('today')
  const dateType = ref<DateType>('deliveryDate')
  const customDate = ref('')
  const searchQuery = ref('')

  // Pedidos de la tienda online pendientes de gestionar (badge del filtro)
  const webPendingCount = ref(0)

  const fetchWebPendingCount = async () => {
    try {
      const data = await OrderService.getOrders({ webPending: 'true' })
      webPendingCount.value = Array.isArray(data) ? data.length : 0
    } catch {
      // silencioso: es sólo el contador del filtro
    }
  }

  // Check if we are in a mode that supports specific date selection
  const showDatePicker = computed(() => {
    return filterMode.value === 'custom' || filterMode.value === 'invoiceError' || filterMode.value === 'unbilled' || filterMode.value === 'returns'
  })

  const fetchOrders = async () => {
    isLoading.value = true
    try {
      const filters: any = {
        dateType: dateType.value
      }

      // 1. Search filter
      if (searchQuery.value) {
        filters.search = searchQuery.value
      }

      // 2. Date filters logic — skip date filters when searching globally
      const today = getECTNow()
      const todayStr = getECTTodayString()

      if (filterMode.value === 'webPending') {
        // Todos los pedidos web por gestionar, sin importar la fecha
        filters.webPending = 'true'
      } else if (filterMode.value === 'invoiceError') {
        filters.invoiceStatus = 'ERROR'
        if (!searchQuery.value && customDate.value) {
          filters.startDate = customDate.value
          filters.endDate = customDate.value
        }
      } else if (filterMode.value === 'unbilled') {
        filters.invoiceStatus = 'UNBILLED'
        if (!searchQuery.value && customDate.value) {
          filters.startDate = customDate.value
          filters.endDate = customDate.value
        }
      } else if (filterMode.value === 'returns') {
        filters.dispatchStatus = 'RETURNED'
        if (!searchQuery.value && customDate.value) {
          filters.startDate = customDate.value
          filters.endDate = customDate.value
        }
      } else if (!searchQuery.value) {
        // Only apply date filters when not searching
        if (filterMode.value === 'today') {
          filters.startDate = todayStr
          filters.endDate = todayStr
        } else if (filterMode.value === 'yesterday') {
          const target = new Date(today)
          target.setDate(target.getDate() - 1)
          filters.startDate = formatDate(target)
          filters.endDate = filters.startDate
        } else if (filterMode.value === 'tomorrow') {
          const target = new Date(today)
          target.setDate(target.getDate() + 1)
          filters.startDate = formatDate(target)
          filters.endDate = filters.startDate
        } else if (filterMode.value === 'custom' && customDate.value) {
          filters.startDate = customDate.value
          filters.endDate = customDate.value
        }
      }
      // When searchQuery is set in non-status modes, no date filter is applied (global search)

      fetchWebPendingCount()
      const data = await OrderService.getOrders(filters)
      orders.value = data
    } catch (error) {
      console.error('Error fetching orders:', error)
      showError('Error al cargar los pedidos')
    } finally {
      isLoading.value = false
    }
  }

  // Simple formatter YYYY-MM-DD
  const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  // Reactivity
  watch([filterMode, customDate, dateType], () => {
    // Logic for clearing 'customDate' when switching modes could be here,
    // but typically we might want to persist if the user comes back.
    // However, if switching To 'today', customDate is ignored anyway.

    // Safety check: don't fetch if custom is empty
    if (filterMode.value === 'custom' && !customDate.value) return

    fetchOrders()
  })

  // Debounced search
  let searchTimeout: any = null
  watch(searchQuery, () => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      fetchOrders()
    }, 500)
  })

  return {
    orders,
    isLoading,
    filterMode,
    dateType,
    customDate,
    searchQuery,
    showDatePicker,
    fetchOrders,
    webPendingCount,
    fetchWebPendingCount
  }
}
