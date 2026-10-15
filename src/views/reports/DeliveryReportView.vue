<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { deliveryService, type DeliveryReport, type DeliveryPerson } from '@/services/delivery.service'
import OrderService from '@/services/order.service'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'
import { useToast } from '@/composables/useToast'
import DeliveryManagementModal from '@/components/modals/DeliveryManagementModal.vue'

const report = ref<DeliveryReport | null>(null)
const riders = ref<DeliveryPerson[]>([])
const loading = ref(false)
const { success, error: showError } = useToast()

// Pagination State
const currentPage = ref(1)
const itemsPerPage = 10

const totalPages = computed(() => report.value?.totalPages || 1)

const setPageAndFetch = async (page: number) => {
  currentPage.value = page
  await generateReport(true)
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) setPageAndFetch(currentPage.value + 1)
}

const prevPage = () => {
  if (currentPage.value > 1) setPageAndFetch(currentPage.value - 1)
}

// Assignment Modal State
const isManagementModalOpen = ref(false)
const isAssignModalOpen = ref(false)
const selectedOrder = ref<any>(null)
const assigneeRiderId = ref('')
const assigneeRiderName = ref('')
const isAssigning = ref(false)
const isDropdownOpen = ref(false)
const sidebarOpen = ref(false)
const selectedOrderIds = ref<string[]>([])
const isBulkAssignModalOpen = ref(false)

const selectRiderForAssign = (rider: DeliveryPerson) => {
  assigneeRiderId.value = rider._id || ''
  assigneeRiderName.value = rider.name
  isDropdownOpen.value = false
}

const toggleSelection = (orderId: string) => {
  if (selectedOrderIds.value.includes(orderId)) {
    selectedOrderIds.value = selectedOrderIds.value.filter(id => id !== orderId)
  } else {
    selectedOrderIds.value.push(orderId)
  }
}

const toggleAll = (event: Event) => {
  const isChecked = (event.target as HTMLInputElement).checked
  if (isChecked && report.value) {
    selectedOrderIds.value = report.value.orders.map((o: any) => o._id)
  } else {
    selectedOrderIds.value = []
  }
}

const openBulkAssignModal = () => {
  if (selectedOrderIds.value.length === 0) return
  assigneeRiderId.value = ''
  assigneeRiderName.value = ''
  isDropdownOpen.value = false
  isBulkAssignModalOpen.value = true
}

const executeBulkAssign = async () => {
  if (!assigneeRiderId.value) return
  isAssigning.value = true
  try {
    const rider = riders.value.find(r => r._id === assigneeRiderId.value)
    if (!rider) throw new Error('Rider not found')

    const deliveryData = {
      name: rider.name,
      identification: rider.identification,
      personId: rider._id
    }

    await OrderService.bulkAssign(selectedOrderIds.value, deliveryData)

    success(`${selectedOrderIds.value.length} pedidos asignados a ${rider.name}.`)
    isBulkAssignModalOpen.value = false
    selectedOrderIds.value = []
    generateReport() // Refresh report
  } catch (error: any) {
    showError('Error al asignar pedidos masivamente.')
  } finally {
    isAssigning.value = false
  }
}

const filters = ref<{
  startDate: string;
  endDate: string;
  personId: string;
}>({
  startDate: '',
  endDate: '',
  personId: ''
})

const getLocalDate = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const initFilters = () => {
  const now = new Date()
  // Default: from 1st of current month to 7 days in the future
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextWeek = new Date(now)
  nextWeek.setDate(now.getDate() + 7)

  filters.value.startDate = getLocalDate(firstDay)
  filters.value.endDate = getLocalDate(nextWeek)
}

const fetchRiders = async () => {
  try {
    riders.value = await deliveryService.getPersonnel()
  } catch (error) {
    console.error('Error fetching riders:', error)
  }
}

const generateReport = async (isPageChange = false) => {
  if (!isPageChange) currentPage.value = 1

  loading.value = true
  try {
    report.value = await deliveryService.getReport(
      filters.value.startDate as string,
      filters.value.endDate as string,
      filters.value.personId || undefined,
      currentPage.value,
      itemsPerPage
    )
    selectedOrderIds.value = []
  } catch (error) {
    console.error('Error generating report:', error)
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'Por definir'
  return new Date(dateStr).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const openAssignModal = (order: any) => {
  selectedOrder.value = order
  assigneeRiderId.value = order.deliveryPerson?.personId || ''
  assigneeRiderName.value = order.deliveryPerson?.name || ''
  isDropdownOpen.value = false
  isAssignModalOpen.value = true
}

const executeAssign = async () => {
  if (!selectedOrder.value || !assigneeRiderId.value) return
  isAssigning.value = true
  try {
    const rider = riders.value.find(r => r._id === assigneeRiderId.value)
    if (!rider) throw new Error('Rider not found')

    await OrderService.updateOrder(selectedOrder.value._id, {
      deliveryPerson: {
        name: rider.name,
        identification: rider.identification,
        personId: rider._id
      }
    })

    success('Motorizado asignado correctamente.')
    isAssignModalOpen.value = false
    generateReport() // Refresh report
  } catch (error: any) {
    showError(error.response?.data?.message || 'Error al asignar motorizado.')
  } finally {
    isAssigning.value = false
  }
}

onMounted(() => {
  initFilters()
  fetchRiders()
  generateReport()
})
</script>

<template>
  <div class="page-layout">

    <!-- Mobile overlay -->
    <Transition name="fade">
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>
    </Transition>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="sidebar-head">
        <div class="sidebar-brand">
          <i class="fas fa-truck-fast"></i>
          <span>Motorizados</span>
        </div>
        <button class="btn-close-sidebar" @click="sidebarOpen = false">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-top">

          <div class="nav-section">
            <span class="section-label">Período</span>
            <div class="date-field">
              <span class="date-label">Desde</span>
              <CustomDatePicker label="" v-model="filters.startDate" />
            </div>
            <div class="date-field">
              <span class="date-label">Hasta</span>
              <CustomDatePicker label="" v-model="filters.endDate" />
            </div>
          </div>

          <div class="nav-section">
            <span class="section-label">Transporte</span>
            <select class="sidebar-select" v-model="filters.personId">
              <option value="">Todos los motorizados</option>
              <option v-for="rider in riders" :key="rider._id" :value="rider._id">
                {{ rider.name }}
              </option>
            </select>
          </div>

          <button @click="generateReport(false); sidebarOpen = false" class="btn-update" :disabled="loading">
            <i class="fa-solid fa-sync" :class="{ 'fa-spin': loading }"></i>
            Actualizar Reporte
          </button>

        </div>

        <div class="nav-bottom">
          <button class="btn-nav-action" @click="isManagementModalOpen = true; sidebarOpen = false">
            <i class="fa-solid fa-users-gear"></i>
            <span>Gestionar Motorizados</span>
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
          <h1>Motorizados / Transporte</h1>
          <p v-if="report">{{ report.count }} entregas · ${{ report.total.toFixed(2) }} total</p>
          <p v-else-if="loading">Cargando...</p>
          <p v-else>Consulta y liquida valores de envío</p>
        </div>
        <button @click="generateReport(false)" class="btn-refresh" :disabled="loading" title="Actualizar">
          <i class="fa-solid fa-sync" :class="{ 'fa-spin': loading }"></i>
        </button>
      </div>

      <!-- Desktop inline filter bar -->
      <div class="desktop-filters">
        <div class="filter-group">
          <span class="filter-label">Desde</span>
          <CustomDatePicker v-model="filters.startDate" />
        </div>
        <div class="filter-group">
          <span class="filter-label">Hasta</span>
          <CustomDatePicker v-model="filters.endDate" />
        </div>
        <div class="filter-group filter-group--wide">
          <span class="filter-label">Transporte</span>
          <select class="filter-select" v-model="filters.personId">
            <option value="">Todos los motorizados</option>
            <option v-for="rider in riders" :key="rider._id" :value="rider._id">{{ rider.name }}</option>
          </select>
        </div>
        <div class="filter-actions">
          <button @click="generateReport(false)" class="btn-update-inline" :disabled="loading">
            <i class="fa-solid fa-sync" :class="{ 'fa-spin': loading }"></i>
            Actualizar Reporte
          </button>
          <button class="btn-manage-inline" @click="isManagementModalOpen = true">
            <i class="fa-solid fa-users-gear"></i>
            Gestionar Motorizados
          </button>
        </div>
      </div>

    <div v-if="report" class="report-content">
      <div class="summary-cards">
        <div class="summary-card total">
          <span class="label">Total a Pagar</span>
          <span class="value">${{ report.total.toFixed(2) }}</span>
        </div>
        <div class="summary-card count">
          <span class="label">Total Entregas</span>
          <span class="value">{{ report.count }}</span>
        </div>
      </div>

      <div class="details-section card">
        <h3>Desglose por Motorizado / Transporte</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Transporte</th>
              <th>Entregas</th>
              <th>Total Acumulado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in report.summary" :key="item.name">
              <td>{{ item.name }}</td>
              <td>{{ item.count }}</td>
              <td class="amount">${{ item.total.toFixed(2) }}</td>
            </tr>
            <tr v-if="report.summary.length === 0">
              <td colspan="3" class="empty">No hay datos para este periodo.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="orders-section card">
        <div class="section-header">
            <h3>Detalle de Pedidos</h3>
            <button v-if="selectedOrderIds.length > 0" class="btn-bulk-assign" @click="openBulkAssignModal">
                <i class="fa-solid fa-user-tag"></i> Asignar ({{ selectedOrderIds.length }})
            </button>
        </div>
        <div class="table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>
                    <input type="checkbox" @change="toggleAll" :checked="report.orders.length > 0 && selectedOrderIds.length > 0 && selectedOrderIds.length >= report.orders.length" />
                </th>
                <th>Fecha Entrega</th>
                <th>Cliente</th>
                <th>Motorizado / Transporte</th>
                <th>Valor Envío</th>
                <th>Total Pedido</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="loading">
                <tr v-for="n in 5" :key="`skeleton-${n}`" class="skeleton-row">
                  <td><div class="skeleton skeleton-box"></div></td>
                  <td><div class="skeleton skeleton-text" style="width: 70%"></div></td>
                  <td><div class="skeleton skeleton-text" style="width: 90%"></div></td>
                  <td><div class="skeleton skeleton-badge"></div></td>
                  <td><div class="skeleton skeleton-text" style="width: 50%"></div></td>
                  <td><div class="skeleton skeleton-text" style="width: 60%"></div></td>
                  <td><div class="skeleton skeleton-box"></div></td>
                </tr>
              </template>
              <template v-else-if="report.orders.length > 0">
                <tr v-for="order in report.orders" :key="order._id" :class="{ 'selected-row': selectedOrderIds.includes(order._id) }">
                  <td>
                      <input type="checkbox" :checked="selectedOrderIds.includes(order._id)" @change="toggleSelection(order._id)" />
                  </td>
                  <td>{{ formatDate(order.deliveryDate) }}</td>
                  <td>{{ order.customerName }}</td>
                  <td>
                    <div v-if="order.deliveryPerson?.name" class="rider-tag">
                      <i class="fa-solid fa-truck-fast"></i>
                      {{ order.deliveryPerson.name }}
                    </div>
                    <div v-else class="rider-tag unassigned">
                      <i class="fa-solid fa-triangle-exclamation"></i>
                      Sin asignar
                    </div>
                  </td>
                  <td class="amount">${{ order.deliveryValue.toFixed(2) }}</td>
                  <td>${{ order.totalValue.toFixed(2) }}</td>
                  <td>
                    <button @click="openAssignModal(order)" class="btn-table-action" :title="order.deliveryPerson?.name ? 'Cambiar Motorizado' : 'Asignar Motorizado'">
                      <i class="fa-solid fa-user-plus"></i>
                    </button>
                  </td>
                </tr>
              </template>
              <template v-else>
                <tr>
                  <td colspan="7" class="empty">No hay pedidos para este periodo.</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        
        <div class="pagination-controls" v-if="totalPages > 1">
           <button @click="prevPage" :disabled="currentPage === 1" class="btn-icon">
              <i class="fa-solid fa-chevron-left"></i>
           </button>
           <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
           <button @click="nextPage" :disabled="currentPage === totalPages" class="btn-icon">
              <i class="fa-solid fa-chevron-right"></i>
           </button>
        </div>
      </div>
    </div>

    <!-- Bulk Assign Modal -->
    <div v-if="isBulkAssignModalOpen" class="modal-overlay" @click.self="isBulkAssignModalOpen = false">
      <div class="modal quick-assign-modal">
        <header class="modal-header">
          <h2>Asignación Masiva</h2>
          <p>Asignando <strong>{{ selectedOrderIds.length }}</strong> pedidos seleccionados.</p>
        </header>

        <div class="modal-body">
          <div class="form-group">
            <label>Seleccionar Motorizado o Transporte</label>
            <div class="custom-dropdown-container">
               <div 
                 class="dropdown-trigger" 
                 @click="isDropdownOpen = !isDropdownOpen"
                 :class="{ 'open': isDropdownOpen, 'placeholder': !assigneeRiderId }"
               >
                  <span>{{ assigneeRiderName || 'Seleccione transporte...' }}</span>
                  <i class="fa-solid fa-chevron-down arrow"></i>
               </div>
               
               <div v-if="isDropdownOpen" class="dropdown-menu">
                  <div 
                    v-for="rider in riders" 
                    :key="rider._id" 
                    class="dropdown-option"
                    :class="{ 'selected': assigneeRiderId === rider._id }"
                    @click="selectRiderForAssign(rider)"
                  >
                     <div class="option-avatar">{{ rider.name.charAt(0) }}</div>
                     <div class="option-details">
                        <span class="option-name">{{ rider.name }}</span>
                        <span class="option-id">{{ rider.identification }}</span>
                     </div>
                     <i v-if="assigneeRiderId === rider._id" class="fa-solid fa-check check-icon"></i>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="isBulkAssignModalOpen = false" class="btn-secondary" :disabled="isAssigning">Cancelar</button>
          <button @click="executeBulkAssign" class="btn-primary" :disabled="isAssigning || !assigneeRiderId">
            <i v-if="isAssigning" class="fa-solid fa-spinner fa-spin"></i>
            Asignar a Todos
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Assign Modal -->
    <div v-if="isAssignModalOpen" class="modal-overlay" @click.self="isAssignModalOpen = false">
      <div class="modal quick-assign-modal">
        <header class="modal-header">
          <h2>Asignar Transporte</h2>
          <p>Pedido para: <strong>{{ selectedOrder.customerName }}</strong></p>
        </header>

        <div class="modal-body">
          <div class="form-group">
            <label>Seleccionar Motorizado o Transporte</label>
            <div class="custom-dropdown-container">
               <div 
                 class="dropdown-trigger" 
                 @click="isDropdownOpen = !isDropdownOpen"
                 :class="{ 'open': isDropdownOpen, 'placeholder': !assigneeRiderId }"
               >
                  <span>{{ assigneeRiderName || 'Seleccione transporte...' }}</span>
                  <i class="fa-solid fa-chevron-down arrow"></i>
               </div>
               
               <div v-if="isDropdownOpen" class="dropdown-menu">
                  <div 
                    v-for="rider in riders" 
                    :key="rider._id" 
                    class="dropdown-option"
                    :class="{ 'selected': assigneeRiderId === rider._id }"
                    @click="selectRiderForAssign(rider)"
                  >
                     <div class="option-avatar">{{ rider.name.charAt(0) }}</div>
                     <div class="option-details">
                        <span class="option-name">{{ rider.name }}</span>
                        <span class="option-id">{{ rider.identification }}</span>
                     </div>
                     <i v-if="assigneeRiderId === rider._id" class="fa-solid fa-check check-icon"></i>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="isAssignModalOpen = false" class="btn-secondary" :disabled="isAssigning">Cancelar</button>
          <button @click="executeAssign" class="btn-primary" :disabled="isAssigning || !assigneeRiderId">
            <i v-if="isAssigning" class="fa-solid fa-spinner fa-spin"></i>
            Guardar Asignación
          </button>
        </div>
      </div>
    </div>

    <!-- Management Modal -->
    <DeliveryManagementModal
      :is-open="isManagementModalOpen"
      @close="isManagementModalOpen = false; fetchRiders()"
    />

    </div> <!-- /main-content -->
  </div> <!-- /page-layout -->
</template>

<style lang="scss" scoped>
// ── Two-panel layout ────────────────────────────────────
.page-layout {
  display: flex;
  min-height: 100vh;
  background: $NICOLE-CREAM;
  position: relative;
}

// ── Sidebar (phone-only, < 768px) ───────────────────────
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

  @media (min-width: 768px) { display: none; }

  @media (max-width: 767px) {
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
  @media (min-width: 768px) { display: none; }
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
  padding: 1rem 0.85rem 1.1rem;
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.nav-top { display: flex; flex-direction: column; }

.nav-bottom {
  padding-top: 0.9rem;
  border-top: 1px solid $border-light;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.1rem;
}

.section-label {
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: $gray-500;
  padding: 0 0.2rem;
  margin-bottom: 0.1rem;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  .date-label {
    font-size: 0.74rem;
    font-weight: 600;
    color: $text-light;
    padding: 0 0.1rem;
  }
}

.sidebar-select {
  width: 100%;
  padding: 0.58rem 0.7rem;
  border-radius: 9px;
  border: 1px solid $border-light;
  background: $gray-50;
  font-size: 0.87rem;
  color: $text-dark;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  &:focus { border-color: $NICOLE-PURPLE; box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1); }
}

.btn-update {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem;
  border-radius: 8px;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  margin-top: 0.15rem;
  transition: opacity 0.2s;
  &:hover:not(:disabled) { opacity: 0.88; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.btn-nav-action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 0.65rem;
  border-radius: 7px;
  border: 1px solid $border-light;
  background: $gray-50;
  color: $text-dark;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  box-sizing: border-box;
  &:hover { border-color: $NICOLE-PURPLE; color: $NICOLE-PURPLE; background: rgba($NICOLE-PURPLE, 0.04); }
  i { font-size: 0.88rem; }
}

// ── Inline filter bar (tablet + desktop) ─────────────────
.desktop-filters {
  display: none;

  @media (min-width: 768px) {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 1.25rem;
    background: white;
    border: 1px solid $border-light;
    border-radius: 14px;
    padding: 1rem 1.5rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  }
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 0 0 210px;

  &--wide { flex: 1; min-width: 180px; }
}

.filter-label {
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: $gray-500;
}

.filter-select {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border-radius: 9px;
  border: 1px solid $border-light;
  background: #f8fafc;
  font-size: 0.87rem;
  color: $text-dark;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  height: 42px;
  &:focus { border-color: $NICOLE-PURPLE; box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1); }
}

.filter-actions {
  display: flex;
  gap: 0.6rem;
  align-items: flex-end;
  margin-left: auto;
  flex-shrink: 0;
  padding-left: 1.25rem;
  border-left: 1px solid $border-light;
}

.btn-update-inline {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  font-weight: 700;
  font-size: 0.87rem;
  cursor: pointer;
  white-space: nowrap;
  height: 42px;
  transition: opacity 0.2s;
  &:hover:not(:disabled) { opacity: 0.88; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.btn-manage-inline {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  border: 1px solid $border-light;
  background: $gray-50;
  color: $text-dark;
  font-size: 0.87rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  height: 42px;
  transition: all 0.15s;
  &:hover { border-color: $NICOLE-PURPLE; color: $NICOLE-PURPLE; background: rgba($NICOLE-PURPLE, 0.04); }
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
    @media (min-width: 768px) { display: none; }
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

// ── Report content ───────────────────────────────────────
.report-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;

  @media (max-width: 600px) { grid-template-columns: 1fr; }
}

.summary-card {
  background: white;
  padding: 1.5rem;
  border-radius: 14px;
  border-left: 4px solid $NICOLE-PURPLE;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid $border-light;
  border-left: 4px solid $NICOLE-PURPLE;

  .label {
    color: $text-light;
    font-size: 0.82rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .value {
    color: $text-dark;
    font-size: 2rem;
    font-weight: 800;
    margin-top: 0.4rem;
  }

  &.total {
    border-left-color: $success;
    .value { color: $success; }
  }
}

.card {
  background: white;
  border-radius: 14px;
  padding: 1.5rem;
  border: 1px solid $border-light;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.btn-bulk-assign {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  transition: opacity 0.2s;
  &:hover { opacity: 0.88; }
}

.btn-primary {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.btn-secondary {
  background: $gray-100;
  color: $text-dark;
  border: 1px solid $border-light;
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.details-section, .orders-section {
  h3 {
    margin: 0 0 1rem;
    color: $text-dark;
    font-size: 1rem;
    font-weight: 700;
  }
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0;

  th {
    text-align: left;
    padding: 1rem;
    border-bottom: 2px solid $gray-100;
    color: $text-light;
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
  }

  tr.selected-row {
    background-color: rgba($NICOLE-PURPLE, 0.03);
  }

  td {
    padding: 1rem;
    border-bottom: 1px solid $gray-50;
    color: $text-dark;
    font-size: 0.95rem;
  }

  .amount {
    font-weight: 700;
    color: $NICOLE-PURPLE;
  }

  .rider-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    background: #f0f9ff;
    color: #0369a1;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;

    &.unassigned {
      background: #fff7ed;
      color: #9a3412;
      border: 1px solid #fed7aa;
    }

    i {
      font-size: 0.8rem;
    }
  }

  .btn-table-action {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: $gray-50;
    color: $text-light;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: rgba($NICOLE-PURPLE, 0.1);
      color: $NICOLE-PURPLE;
      transform: scale(1.1);
    }
  }

  .empty {
    text-align: center;
    padding: 3rem;
    color: $text-light;
    font-style: italic;
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  h3 {
    margin: 0;
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: white;
  width: 95%;
  max-width: 450px;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);

  .modal-header {
    margin-bottom: 2rem;

    h2 {
      margin: 0;
      color: $text-dark;
      font-size: 1.4rem;
    }

    p {
      margin: 0.5rem 0 0;
      color: $text-light;
      font-size: 0.9rem;
    }
  }

  .modal-body {
    margin-bottom: 2rem;
  }

  .custom-dropdown-container {
    position: relative;
    width: 100%;
  }

  .dropdown-trigger {
    width: 100%;
    padding: 0.85rem 1.25rem;
    background: $gray-50;
    border: 1.5px solid $border-light;
    border-radius: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.95rem;
    font-weight: 600;
    color: $text-dark;
    box-sizing: border-box;

    &.placeholder {
      color: $text-light;
      font-weight: 500;
    }

    &.open {
      border-color: $NICOLE-PURPLE;
      background: white;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);

      .arrow {
        transform: rotate(180deg);
      }
    }

    .arrow {
      font-size: 0.8rem;
      color: $text-light;
      transition: transform 0.3s ease;
    }
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: white;
    border-radius: 16px;
    border: 1px solid $border-light;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
    z-index: 100;
    max-height: 250px;
    overflow-y: auto;
    padding: 0.5rem;
    animation: slideDown 0.2s ease-out;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: $gray-200;
      border-radius: 3px;
    }
  }

  .dropdown-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-bottom: 2px;
    text-align: left;

    &:hover {
      background: rgba($NICOLE-PURPLE, 0.05);
    }

    &.selected {
      background: rgba($NICOLE-PURPLE, 0.1);

      .option-name {
        color: $NICOLE-PURPLE;
      }
    }

    .option-avatar {
      width: 32px;
      height: 32px;
      background: $gray-100;
      color: $text-light;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.8rem;
    }

    .option-details {
      flex: 1;
      display: flex;
      flex-direction: column;

      .option-name {
        font-weight: 700;
        font-size: 0.9rem;
        color: $text-dark;
      }

      .option-id {
        font-size: 0.75rem;
        color: $text-light;
      }
    }

    .check-icon {
      color: $NICOLE-PURPLE;
      font-size: 0.9rem;
    }
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-actions {
    display: flex;
    gap: 1rem;

    button {
      flex: 1;
      padding: 1rem;
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-secondary {
      background: $gray-50;
      color: $text-light;
    }

    .btn-primary {
      background: $NICOLE-PURPLE;
      color: white;
    }
  }
}

.table-container {
  overflow-x: auto;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid $border-light;

  .btn-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid $border-light;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text-dark;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: $gray-50;
      color: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .page-info {
    font-size: 0.9rem;
    font-weight: 600;
    color: $text-dark;
  }
}

/* Skeleton Loader */
.skeleton {
  background: linear-gradient(90deg, #f4f4f5 25%, #e4e4e7 50%, #f4f4f5 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 4px;
}

.skeleton-text {
  height: 16px;
  width: 100%;
}

.skeleton-box {
  height: 20px;
  width: 20px;
  border-radius: 4px;
}

.skeleton-badge {
  height: 28px;
  width: 110px;
  border-radius: 20px;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 600px) {
  .summary-cards { grid-template-columns: 1fr; }
}
</style>
