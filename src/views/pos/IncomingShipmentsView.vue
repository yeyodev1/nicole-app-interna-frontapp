<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import POSService, { type POSOrder } from '@/services/pos.service'
import { useOrderExport } from '@/composables/useOrderExport'
import { posRestockService } from '@/services/pos-restock.service'
import ProductionSettingsService from '@/services/production-settings.service'
import POSShipmentCard from './components/POSShipmentCard.vue'
import POSLocationBanner from './components/POSLocationBanner.vue'
import DeliveryModal from './components/DeliveryModal.vue'
import BulkReceptionModal from './components/BulkReceptionModal.vue'
import RestockDailyModal from './components/RestockDailyModal.vue'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import { useToast } from '@/composables/useToast'

type POSFilterMode = 'yesterday' | 'today' | 'tomorrow' | 'all' | 'custom'

const isLoading = ref(false)
const orders = ref<POSOrder[]>([])
const pendingDispatchesForBulk = ref<any[]>([])
const BRANCH_STORAGE_KEY = 'pos_selected_branch'
const selectedBranch = ref(localStorage.getItem(BRANCH_STORAGE_KEY) || '')
const branches = ref<string[]>(['Todas las sucursales'])
const sidebarOpen = ref(false)

const filterMode = ref<POSFilterMode>('today')
const customDate = ref('')
const searchQuery = ref('')
const showDatePicker = computed(() => filterMode.value === 'custom')

const showBulkModal = ref(false)
const showDeliveryModal = ref(false)
const showRestockModal = ref(false)
const showOldClosingConfirm = ref(false)
const pendingProductionFormData = ref<any>(null)
const pendingProductionBranch = ref('')
const selectedOrder = ref<POSOrder | null>(null)
const selectedOrderIds = ref<Set<string>>(new Set())

const isAllSelected = computed(() => {
  if (orders.value.length === 0) return false
  return orders.value.every(o => selectedOrderIds.value.has(o._id))
})

const toggleOrderSelection = (orderId: string) => {
  if (selectedOrderIds.value.has(orderId)) {
    selectedOrderIds.value.delete(orderId)
  } else {
    selectedOrderIds.value.add(orderId)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedOrderIds.value.clear()
  } else {
    orders.value.forEach(o => selectedOrderIds.value.add(o._id))
  }
}

const { success, error: showError, info } = useToast()

const fetchData = async () => {
  isLoading.value = true
  selectedOrderIds.value.clear()
  try {
    const filters = { search: searchQuery.value, filterMode: filterMode.value, date: customDate.value }
    const [pickupData, incomingData, bulkData] = await Promise.all([
      POSService.getPickupOrders(selectedBranch.value, filters),
      POSService.getIncomingDispatches(selectedBranch.value, filters),
      POSService.getIncomingDispatches(selectedBranch.value, {
        filterMode: 'all',
        receptionStatus: ['PENDING', 'PROBLEM']
      })
    ])
    const pickups = pickupData || []
    const incoming = incomingData
      .filter(o => o.posStatus === 'IN_TRANSIT')
      .flatMap(o => (o.dispatches || []).filter(d => d.receptionStatus === 'PENDING').map(d => ({ ...o, orderId: o._id, dispatch: d })))

    pendingDispatchesForBulk.value = bulkData
      .flatMap(o => (o.dispatches || [])
        .filter(d => ['PENDING', 'PROBLEM'].includes(d.receptionStatus))
        .map(d => ({ ...o, orderId: o._id, dispatch: d }))
      )

    const mergedMap = new Map()
    pickups.forEach(o => mergedMap.set(o._id, o))
    incoming.forEach(o => mergedMap.set(o._id, o))
    const allOrders = Array.from(mergedMap.values())
    allOrders.sort((a, b) => (a.deliveryDate ? new Date(a.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER) - (b.deliveryDate ? new Date(b.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER))
    orders.value = allOrders
  } catch (error) {
    console.error('Error fetching data:', error)
    showError('Error cargando información')
  } finally {
    isLoading.value = false
  }
}

let searchTimeout: any = null
watch(searchQuery, () => { if (searchTimeout) clearTimeout(searchTimeout); searchTimeout = setTimeout(fetchData, 500) })
watch(selectedBranch, (v) => { if (v) localStorage.setItem(BRANCH_STORAGE_KEY, v) })
watch([selectedBranch, filterMode], fetchData)
watch(customDate, (val) => { if (val && filterMode.value === 'custom') fetchData() })

const handleMarkAsDeliveredPrep = (order: POSOrder) => { selectedOrder.value = order; showDeliveryModal.value = true }

const handleMarkAsDelivered = async (orderId: string) => {
  try {
    await POSService.markAsDelivered(orderId)
    success('Orden marcada como entregada')
    showDeliveryModal.value = false
    fetchData()
  } catch {
    showError('Error al actualizar estado')
  }
}

const fetchBulkDispatches = async (branch = selectedBranch.value) => {
  try {
    const bulkData = await POSService.getIncomingDispatches(branch, {
      filterMode: 'all',
      receptionStatus: ['PENDING', 'PROBLEM']
    })
    pendingDispatchesForBulk.value = bulkData
      .flatMap(o => (o.dispatches || [])
        .filter(d => ['PENDING', 'PROBLEM'].includes(d.receptionStatus))
        .map(d => ({ ...o, orderId: o._id, dispatch: d }))
      )
  } catch (e) {
    console.error('Error fetching bulk dispatches:', e)
  }
}

const handleBulkBranchChange = (branch: string) => {
  selectedBranch.value = branch
  fetchBulkDispatches(branch)
}

const handleBulkSuccess = () => { success('Recepción Masiva Completada'); showBulkModal.value = false; fetchData() }
const handleRestockSuccess = () => {
  success('Cierre de Producción enviado exitosamente')
  showRestockModal.value = false
  fetchData()
}
const handleNotification = (n: { message: string; type: 'success' | 'error' | 'info' }) => {
  if (n.type === 'success') success(n.message)
  else if (n.type === 'error') showError(n.message)
  else info(n.message)
}

const { isExporting, exportDispatchOrder, exportRestockProductionOrder } = useOrderExport()
const isExportingProduction = ref(false)

const handleExportDispatch = async () => {
  const exportOrders = selectedOrderIds.value.size > 0
    ? orders.value.filter(o => selectedOrderIds.value.has(o._id))
    : orders.value

  if (exportOrders.length === 0) { info('No hay pedidos para exportar'); return }

  try {
    const branchName = selectedBranch.value === 'Todas las sucursales' ? 'General (Todas)' : selectedBranch.value
    await exportDispatchOrder(exportOrders, branchName)
    success('Reporte de Entregas exportado')
  } catch {
    showError('Error al exportar reporte')
  }
}

const handleExportProductionOrder = async () => {
  const branch = selectedBranch.value === 'Todas las sucursales' ? 'San Marino' : selectedBranch.value
  isExportingProduction.value = true
  try {
    const formData = await posRestockService.getDailyForm(branch)
    const hasItems = formData.items.some(i => (i.lastEntry?.pedidoFinal ?? i.lastEntry?.pedidoSugerido ?? 0) > 0)
    if (!hasItems) {
      info('No hay orden de producción para exportar. Primero haz el Cierre de Producción.')
      return
    }
    const lastEntryDate = formData.items.find(i => i.lastEntry)?.lastEntry?.date
    if (lastEntryDate && lastEntryDate !== formData.formDate) {
      pendingProductionFormData.value = formData
      pendingProductionBranch.value = branch
      showOldClosingConfirm.value = true
      return
    }
    await exportRestockProductionOrder(formData, branch)
    success('Orden de Producción exportada')
  } catch {
    showError('Error al exportar la orden de producción')
  } finally {
    isExportingProduction.value = false
  }
}

const confirmExportWithOldClosing = async () => {
  showOldClosingConfirm.value = false
  isExportingProduction.value = true
  try {
    await exportRestockProductionOrder(pendingProductionFormData.value, pendingProductionBranch.value)
    success('Orden de Producción exportada')
  } catch {
    showError('Error al exportar la orden de producción')
  } finally {
    isExportingProduction.value = false
    pendingProductionFormData.value = null
    pendingProductionBranch.value = ''
  }
}

onMounted(async () => {
  try {
    const settings = await ProductionSettingsService.getSettings()
    const destinations = (settings.destinations || []).map((d: any) => d.name)
    branches.value = ['Todas las sucursales', ...destinations]
    const stored = localStorage.getItem(BRANCH_STORAGE_KEY)
    if (stored && destinations.includes(stored)) {
      selectedBranch.value = stored
    } else if (destinations.length > 0) {
      selectedBranch.value = destinations[0]
    }
  } catch (e) {
    console.error('Error fetching dynamic branches:', e)
  }
  fetchData()
})
</script>

<template>
  <div class="pos-layout">

    <!-- Mobile overlay -->
    <Transition name="fade">
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>
    </Transition>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="sidebar-head">
        <div class="sidebar-brand">
          <i class="fa-solid fa-store"></i>
          <span>Gestión Sucursal</span>
        </div>
        <button class="btn-close-sidebar" @click="sidebarOpen = false">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-top">

          <!-- Search -->
          <div class="nav-section">
            <div class="search-wrapper">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                :value="searchQuery"
                @input="searchQuery = ($event.target as HTMLInputElement).value"
                placeholder="Buscar cliente, orden..."
                @keyup.enter="fetchData"
              />
            </div>
          </div>

          <!-- Sucursal -->
          <div class="nav-section">
            <span class="section-label">Sucursal</span>
            <select class="sidebar-select" v-model="selectedBranch">
              <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>

          <!-- Período -->
          <div class="nav-section">
            <span class="section-label">Período</span>
            <div class="nav-pills">
              <button class="nav-pill" :class="{ active: filterMode === 'yesterday' }" @click="filterMode = 'yesterday'">
                <i class="fas fa-chevron-left"></i> Ayer
              </button>
              <button class="nav-pill" :class="{ active: filterMode === 'today' }" @click="filterMode = 'today'">
                <i class="fas fa-calendar-day"></i> Hoy
              </button>
              <button class="nav-pill" :class="{ active: filterMode === 'tomorrow' }" @click="filterMode = 'tomorrow'">
                <i class="fas fa-chevron-right"></i> Mañana
              </button>
              <button class="nav-pill" :class="{ active: filterMode === 'all' }" @click="filterMode = 'all'">
                <i class="fas fa-list"></i> Todos
              </button>
              <button class="nav-pill" :class="{ active: filterMode === 'custom' }" @click="filterMode = 'custom'">
                <i class="fas fa-calendar-alt"></i> Fecha específica
              </button>
            </div>
          </div>

          <!-- Custom date picker -->
          <div v-if="showDatePicker" class="nav-section">
            <span class="section-label">Seleccionar fecha</span>
            <CustomDatePicker :model-value="customDate" @update:model-value="customDate = $event" />
          </div>

          <!-- Select all -->
          <div v-if="orders.length > 0" class="nav-section">
            <button class="btn-select-all-nav" @click="toggleSelectAll">
              <i class="fas" :class="isAllSelected ? 'fa-square-check' : 'fa-square'"></i>
              {{ isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos' }}
            </button>
          </div>

        </div>

        <!-- Actions -->
        <div class="nav-bottom">
          <span class="section-label">Acciones</span>
          <button class="btn-action production" @click="showRestockModal = true; sidebarOpen = false">
            <i class="fa-solid fa-clipboard-check"></i>
            <span>Cierre de Producción</span>
          </button>
          <button class="btn-action bulk" @click="showBulkModal = true; sidebarOpen = false">
            <i class="fa-solid fa-boxes-stacked"></i>
            <span>Recepción Masiva</span>
          </button>
          <button class="btn-action export" @click="handleExportDispatch">
            <i :class="isExporting ? 'fas fa-spinner fa-spin' : 'fas fa-file-excel'"></i>
            <span>{{ selectedOrderIds.size > 0 ? `Entregas (${selectedOrderIds.size} sel.)` : 'Reporte de Entregas' }}</span>
          </button>
          <button class="btn-action production-order" @click="handleExportProductionOrder" :disabled="isExportingProduction">
            <i :class="isExportingProduction ? 'fas fa-spinner fa-spin' : 'fa-solid fa-kitchen-set'"></i>
            <span>Orden de Producción</span>
          </button>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <div class="main-content">

      <!-- Topbar -->
      <div class="topbar">
        <button class="btn-menu" @click="sidebarOpen = true" title="Filtros">
          <i class="fas fa-sliders-h"></i>
        </button>
        <div class="topbar-title">
          <h1>Gestión de Sucursal</h1>
          <p v-if="!isLoading && orders.length > 0">{{ orders.length }} pedidos · {{ selectedBranch }}</p>
          <p v-else-if="isLoading">Cargando...</p>
          <p v-else>{{ selectedBranch }}</p>
        </div>
        <button @click="fetchData" class="btn-refresh" :disabled="isLoading" title="Actualizar">
          <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': isLoading }"></i>
        </button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Cargando información...</span>
      </div>

      <div v-else class="view-content">
        <div v-if="orders.length > 0" class="info-bar">
          <div class="info-text">
            <i class="fa-solid fa-circle-check"></i>
            <template v-if="selectedBranch === 'Todas las sucursales'">
              <strong>Reporte Unificado</strong> — todas las sucursales
            </template>
            <template v-else>
              Pedidos listos en <strong>{{ selectedBranch }}</strong>
            </template>
          </div>
          <POSLocationBanner :selectedBranch="selectedBranch" @open-restock="showRestockModal = true" />
        </div>

        <div class="shipments-grid">
          <div v-if="orders.length === 0" class="empty-state">
            <i class="fa-regular fa-calendar-xmark"></i>
            <h3>Todo al día en {{ selectedBranch }}</h3>
            <p v-if="searchQuery">No encontramos pedidos con "{{ searchQuery }}".</p>
            <p v-else>No hay pedidos pendientes en <strong>{{ selectedBranch }}</strong> por ahora.</p>
          </div>
          <POSShipmentCard
            v-for="order in orders"
            :key="order._id"
            :order="order"
            :selectedBranch="selectedBranch"
            :isSelected="selectedOrderIds.has(order._id)"
            @deliver="handleMarkAsDeliveredPrep"
            @toggle-selection="toggleOrderSelection"
          />
        </div>
      </div>

    </div><!-- /main-content -->

    <!-- Modals -->
    <BulkReceptionModal
      :is-open="showBulkModal"
      :dispatches="pendingDispatchesForBulk"
      :selected-branch="selectedBranch"
      :branches="branches"
      @close="showBulkModal = false"
      @success="handleBulkSuccess"
      @open-restock="showBulkModal = false; showRestockModal = true"
      @change-branch="handleBulkBranchChange"
    />
    <DeliveryModal
      :is-open="showDeliveryModal"
      :order="selectedOrder || ({} as POSOrder)"
      @close="showDeliveryModal = false"
      @confirm="handleMarkAsDelivered"
    />
    <RestockDailyModal
      :is-open="showRestockModal"
      :branch="selectedBranch === 'Todas las sucursales' ? 'San Marino' : selectedBranch"
      @close="showRestockModal = false"
      @success="handleRestockSuccess"
      @notify="handleNotification"
    />
    <ConfirmationModal
      :is-open="showOldClosingConfirm"
      title="No hay cierre de hoy"
      :message="`El cierre de producción de hoy aún no ha sido enviado.\n\nSe usará el cierre del ${pendingProductionFormData?.items?.find((i: any) => i.lastEntry)?.lastEntry?.date ?? ''} (día anterior) para generar la Orden de Producción.\n\n¿Deseas continuar de todas formas?`"
      confirm-text="Sí, exportar con cierre anterior"
      cancel-text="Cancelar"
      @close="showOldClosingConfirm = false"
      @confirm="confirmExportWithOldClosing"
    />

    <!-- Floating branch badge -->
    <div class="floating-badge" :class="selectedBranch.toLowerCase().replace(/\s+/g, '-')">
      <div class="badge-icon"><i class="fa-solid fa-store"></i></div>
      <div class="badge-content">
        <span class="badge-label">Vista actual</span>
        <span class="badge-name">{{ selectedBranch === 'Todas las sucursales' ? 'Todas' : selectedBranch }}</span>
      </div>
    </div>

  </div><!-- /pos-layout -->
</template>

<style lang="scss" scoped>
// ── Two-panel layout ────────────────────────────────────
.pos-layout {
  display: flex;
  min-height: 100vh;
  background: $NICOLE-CREAM;
  position: relative;
}

// ── Sidebar ──────────────────────────────────────────────
.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: white;
  border-right: 1px solid $border-light;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;

  @media (min-width: 1024px) { display: flex; } // always visible desktop

  @media (max-width: 1023px) {
    position: fixed;
    left: 0;
    top: 52px;
    height: calc(100% - 52px);
    z-index: 300;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
    &.sidebar-open { transform: translateX(0); }
  }
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 299;
  backdrop-filter: blur(2px);
  @media (min-width: 1024px) { display: none; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1rem 0.9rem;
  border-bottom: 1px solid $border-light;
  flex-shrink: 0;

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: $NICOLE-PURPLE;
    font-weight: 800;
    font-size: 0.95rem;
    i { font-size: 0.95rem; }
  }

  .btn-close-sidebar {
    width: 28px; height: 28px;
    border: none;
    background: $gray-100;
    border-radius: 6px;
    color: $text-light;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8rem;
    transition: all 0.15s;
    &:hover { background: $gray-200; color: $text-dark; }
    @media (min-width: 1024px) { display: none; }
  }
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 0.9rem 0.85rem 1rem;
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.nav-top { display: flex; flex-direction: column; }

.nav-bottom {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-top: 0.9rem;
  border-top: 1px solid $border-light;
  flex-shrink: 0;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.section-label {
  font-size: 0.63rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #94a3b8;
  padding: 0 0.2rem;
  margin-bottom: 0.15rem;
  display: block;
}

.search-wrapper {
  position: relative;

  i {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    font-size: 0.8rem;
    pointer-events: none;
  }

  input {
    width: 100%;
    padding: 0.55rem 0.8rem 0.55rem 2rem;
    border-radius: 9px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 0.88rem;
    outline: none;
    transition: all 0.2s;
    box-sizing: border-box;

    &:focus {
      background: white;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.12);
    }
    &::placeholder { color: #94a3b8; }
  }
}

.sidebar-select {
  width: 100%;
  padding: 0.52rem 0.7rem;
  border-radius: 9px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.87rem;
  color: $text-dark;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  &:focus { border-color: $NICOLE-PURPLE; box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1); }
}

.nav-pills {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.nav-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.44rem 0.65rem;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 0.855rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;

  i {
    width: 13px;
    text-align: center;
    font-size: 0.75rem;
    color: #94a3b8;
    flex-shrink: 0;
    transition: color 0.15s;
  }

  &:hover { background: #f1f5f9; color: #1e293b; i { color: #64748b; } }

  &.active {
    background: rgba($NICOLE-PURPLE, 0.09);
    color: $NICOLE-PURPLE;
    font-weight: 700;
    i { color: $NICOLE-PURPLE; }
  }
}

.btn-select-all-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border-radius: 7px;
  border: 1px dashed #c4b5fd;
  background: #faf5ff;
  color: #7c3aed;
  font-size: 0.855rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  box-sizing: border-box;
  &:hover { background: #ede9fe; }
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.55rem 0.65rem;
  border-radius: 7px;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.2s, border-color 0.2s;
  box-sizing: border-box;

  i { font-size: 0.88rem; flex-shrink: 0; }

  &.production {
    background: rgba($NICOLE-PURPLE, 0.07);
    color: $NICOLE-PURPLE;
    border-color: rgba($NICOLE-PURPLE, 0.2);
    &:hover { background: rgba($NICOLE-PURPLE, 0.13); }
  }

  &.bulk {
    background: #f0f9ff;
    color: #0284c7;
    border-color: #e0f2fe;
    &:hover { background: #e0f2fe; border-color: #bae6fd; }
  }

  &.export {
    background: #f0fdf4;
    color: #16a34a;
    border-color: #dcfce7;
    &:hover { background: #dcfce7; border-color: #bbf7d0; }
  }

  &.production-order {
    background: #fff7ed;
    color: #c2410c;
    border-color: #fed7aa;
    &:hover { background: #fed7aa; border-color: #fdba74; }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }
}

// ── Main content ─────────────────────────────────────────
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  gap: 1.25rem;

  @media (min-width: 1024px) { padding: 2rem; }
}

// ── Topbar ───────────────────────────────────────────────
.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  border: 1px solid $border-light;
  border-radius: 14px;
  padding: 0.9rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);

  .btn-menu {
    width: 38px; height: 38px;
    border: 1px solid $border-light;
    background: white;
    border-radius: 9px;
    color: $NICOLE-PURPLE;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem;
    transition: all 0.2s;
    flex-shrink: 0;
    &:hover { background: rgba($NICOLE-PURPLE, 0.06); border-color: rgba($NICOLE-PURPLE, 0.3); }
    @media (min-width: 1024px) { display: none; }
  }

  .topbar-title {
    flex: 1;
    h1 { margin: 0; font-size: 1.2rem; font-weight: 800; color: $NICOLE-PURPLE; }
    p { margin: 0; font-size: 0.78rem; color: $gray-500; font-weight: 500; }
  }

  .btn-refresh {
    width: 38px; height: 38px;
    border-radius: 9px;
    border: 1px solid $border-light;
    background: white;
    color: $text-light;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.95rem;
    transition: all 0.2s;
    flex-shrink: 0;
    &:hover { color: $NICOLE-PURPLE; border-color: rgba($NICOLE-PURPLE, 0.3); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
}

// ── View content ─────────────────────────────────────────
.view-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.info-bar {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  padding: 0.65rem 1rem;
  border-radius: 10px;
  color: #0369a1;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  .info-text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}

.shipments-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: 640px) { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem; }
  @media (min-width: 1280px) { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  background: white;
  border-radius: 16px;
  border: 1px dashed $border-light;

  i { font-size: 3rem; margin-bottom: 1.5rem; color: #cbd5e1; display: block; }
  h3 { margin: 0.5rem 0; color: $text-dark; font-size: 1.3rem; }
  p { color: $text-light; margin: 0.25rem 0 0; }
}

.spinner {
  margin: 0 auto 1.5rem;
  width: 40px; height: 40px;
  border: 4px solid #f1f5f9;
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

// ── Floating branch badge ─────────────────────────────────
.floating-badge {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 0.9rem 1.6rem;
  border-radius: 60px;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.13);
  display: flex;
  align-items: center;
  gap: 0.9rem;
  z-index: 100;
  border: 2px solid $NICOLE-PURPLE;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 480px) {
    padding: 0.65rem;
    border-radius: 50%;
    .badge-content { display: none; }
  }
}

.floating-badge.mall-del-sol { border-color: #3b82f6; .badge-icon { background: rgba(#3b82f6, 0.1); color: #3b82f6; } }
.floating-badge.san-marino { border-color: #a855f7; .badge-icon { background: rgba(#a855f7, 0.1); color: #a855f7; } }
.floating-badge.todas-las-sucursales { border-color: $NICOLE-PURPLE; .badge-icon { background: rgba($NICOLE-PURPLE, 0.1); color: $NICOLE-PURPLE; } }

.badge-icon {
  width: 38px; height: 38px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
  background: rgba($NICOLE-PURPLE, 0.1);
  color: $NICOLE-PURPLE;
}

.badge-content { display: flex; flex-direction: column; }
.badge-label { font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 2px; line-height: 1; margin-bottom: 3px; }
.badge-name { font-size: 1.1rem; font-weight: 900; color: #0f172a; line-height: 1; white-space: nowrap; }

@keyframes slideUpFade {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
