<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ProductionHistoryPanel from './components/ProductionHistoryPanel.vue'
import ProductionExportModal from './components/ProductionExportModal.vue'
import ProductionBatchModal from './components/ProductionBatchModal.vue'
import ProductionSummaryHeader from './components/ProductionSummaryHeader.vue'
import ProductionDestinationCard from './components/ProductionDestinationCard.vue'
import ProductionBatchBar from './components/ProductionBatchBar.vue'
import { useProductionSummary } from '@/composables/useProductionSummary'
import { useOrderExport } from '@/composables/useOrderExport'
import { useToast } from '@/composables/useToast'
import { getECTNow, parseECTDate } from '@/utils/dateUtils'

const {
  isLoading,
  error,
  fetchSummary,
  showHistory,
  isBackgroundLoading,
  rawBucketFilter,
  rawFilteredOrders,
  rawStatsByDestRoundCategory,
  collapsedProductCategories,
  toggleProductCategory,
  selectedRawProducts,
  toggleRawProductSelection,
  clearRawSelection,
  rawOrders,
  sourceFilter,
  batchCompleteSelected,
  isBatchProcessing,
  batchQuantities,
  prepareBatchQuantities,
  setBatchQuantity,
  selectedRows,
  selectedProductNames,
  sourceCounts,
  filterOrdersForExport,
  contificoCatByName,
} = useProductionSummary()

// Sucursales/destinos para el modal de exportación
const exportDestinations = computed(() => {
  const base = ['San Marino', 'Mall del Sol', 'Centro Prod.', 'Delivery']
  for (const d of Object.keys(rawStatsByDestRoundCategory.value)) {
    if (!base.includes(d)) base.push(d)
  }
  return base
})

const { isExporting, exportDispatchOrder, exportProductionOrder } = useOrderExport()
const showExportModal = ref(false)
const exportMode = ref<'dispatch' | 'production'>('dispatch')
const isBatchConfirmOpen = ref(false)

const { success, error: showError } = useToast()

const toggleHistoryPanel = () => {
  showHistory.value = !showHistory.value
  if (!showHistory.value) {
    fetchSummary()
  }
}

// Orden 5: aviso de pedidos atrasados de los últimos 7 días (sin enviar o parciales).
// Los de hace más de 7 días no se cuentan. Respeta el filtro Todas / Nicole / Sucree.
const showDelayed = ref(false)
const delayedOrders = computed(() => {
  const today = getECTNow()
  today.setHours(0, 0, 0, 0)
  const from = new Date(today)
  from.setDate(from.getDate() - 7)
  return rawOrders.value
    .filter(o => {
      if (o.productionStage === 'VOID' || !o.deliveryDate) return false
      if (o.dispatchStatus && !['NOT_SENT', 'PARTIAL'].includes(o.dispatchStatus)) return false
      if (sourceFilter.value !== 'all' && o.contificoSource !== sourceFilter.value) return false
      const d = parseECTDate(o.deliveryDate)
      return d >= from && d < today
    })
    .map(o => {
      const sent = new Map<string, number>()
      for (const d of o.dispatches || []) for (const it of d.items || []) sent.set(String(it.productId), (sent.get(String(it.productId)) || 0) + (Number(it.quantitySent) || 0))
      const missing = (o.products || [])
        .map((p: any) => ({ name: p.name, qty: Math.max(0, (p.quantity || 0) - (sent.get(String(p._id)) || 0)) }))
        .filter((p: any) => p.qty > 0)
      return {
        id: o._id,
        date: String(o.deliveryDate).slice(0, 10).split('-').reverse().join('/'),
        sortKey: String(o.deliveryDate),
        who: o.customerName || o.branch || 'Sin nombre',
        status: o.dispatchStatus === 'PARTIAL' ? 'Parcial' : 'Sin enviar',
        missing,
      }
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
})

// Abre el modal de producción con las cantidades precargadas (todo lo pendiente)
const openBatchConfirm = () => {
  prepareBatchQuantities()
  isBatchConfirmOpen.value = true
}

const handleBatchConfirm = async () => {
  if (isBatchProcessing.value) return // evita doble registro si vuelven a mantener el botón
  try {
    const result = await batchCompleteSelected()
    isBatchConfirmOpen.value = false
    if (result.sent === 0) {
      showError('No había nada pendiente por producir en la selección.')
    } else if (result.failures.length > 0) {
      showError(`Se registraron ${result.sent} unids, pero fallaron: ${result.failures.join(', ')}. Vuelve a intentarlo con esos productos.`)
    } else if (result.eliminated > 0) {
      success(`¡Listo! ${result.sent} unidades producidas y ${result.eliminated} eliminadas del pedido.`)
    } else {
      success(`¡Listo! Se registraron ${result.sent} unidades producidas.`)
    }
  } catch (err) {
    console.error(err)
    showError('No se pudo registrar la producción. Revisa tu conexión e inténtalo de nuevo.')
  }
}

const handleExportClick = (mode: 'dispatch' | 'production') => {
  exportMode.value = mode
  showExportModal.value = true
}

// Cuántos pedidos saldrían con la fecha/sucursal elegidas en el modal
const exportPreviewCount = ref<number | null>(null)

const updateExportPreview = (opts: { destination: string; date: string }) => {
  try {
    exportPreviewCount.value = filterOrdersForExport(opts).length
  } catch {
    exportPreviewCount.value = null
  }
}

const handleExportConfirm = async (opts: { responsibleName: string; destination: string; date: string }) => {
  try {
    // Pedidos por sucursal y fecha, independiente de los filtros de la pantalla
    let ordersToExport = filterOrdersForExport({ date: opts.date, destination: opts.destination })

    const selectedProducts = selectedProductNames.value
    if (selectedProducts.length > 0) {
      ordersToExport = ordersToExport
        .filter((order: any) => order.products.some((p: any) => selectedProducts.includes(p.name)))
        .map((order: any) => ({
          ...order,
          products: order.products.filter((p: any) => selectedProducts.includes(p.name)),
        }))
    }

    if (ordersToExport.length === 0) {
      showError('No hay pedidos con esa fecha y sucursal. Cambia la fecha o elige "Todas las sucursales".')
      return
    }

    if (exportMode.value === 'dispatch') {
      const label = opts.destination === 'all' ? 'Todas las sucursales' : opts.destination
      await exportDispatchOrder(ordersToExport, label, contificoCatByName.value)
      success('Orden de Entrega exportada (Excel descargado).')
    } else {
      // Excel con las categorías tal cual Contífico
      await exportProductionOrder(ordersToExport, opts.responsibleName, contificoCatByName.value)
      success('Orden de Producción exportada (Excel descargado).')
    }

    showExportModal.value = false
    clearRawSelection()
  } catch (err: any) {
    console.error(err)
    showError(`No se pudo exportar: ${err?.message || 'error inesperado'}`)
  }
}

onMounted(() => {
  fetchSummary()
})
</script>

<template>
  <div class="summary-view" :class="{ 'has-selection': selectedRawProducts.size > 0 }">
    <ProductionSummaryHeader
      :is-background-loading="isBackgroundLoading"
      :show-history="showHistory"
      :is-loading="isLoading"
      :source-filter="sourceFilter"
      :bucket-filter="rawBucketFilter"
      :has-orders="rawOrders.length > 0"
      :selected-count="selectedRawProducts.size"
      :is-exporting="isExporting"
      :export-mode="exportMode"
      :source-counts="sourceCounts"
      @toggle-history="toggleHistoryPanel"
      @refresh="fetchSummary(false)"
      @set-source="sourceFilter = $event"
      @set-bucket="rawBucketFilter = $event"
      @export="handleExportClick"
    />

    <!-- LOADING -->
    <div v-if="isLoading" class="loading-state">
      <span class="loader"></span>
      <p>Cargando producción...</p>
    </div>

    <!-- ERROR -->
    <div v-else-if="error" class="error-msg">
      <i class="fas fa-exclamation-triangle"></i>
      {{ error }}
      <button @click="fetchSummary(false)">Reintentar</button>
    </div>

    <!-- HISTORY VIEW -->
    <ProductionHistoryPanel v-else-if="showHistory" @close="toggleHistoryPanel" />

    <!-- MAIN: Destination Grid -->
    <div v-else class="content-wrapper">
      <div v-if="delayedOrders.length > 0" class="delayed-alert">
        <button type="button" class="delayed-band" :aria-expanded="showDelayed" @click="showDelayed = !showDelayed">
          ⚠ {{ delayedOrders.length }} pedido{{ delayedOrders.length === 1 ? '' : 's' }} atrasado{{ delayedOrders.length === 1 ? '' : 's' }} sin enviar (últimos 7 días)
          <i class="fas" :class="showDelayed ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
        </button>
        <ul v-if="showDelayed" class="delayed-list">
          <li v-for="o in delayedOrders" :key="o.id">
            <span class="d-date">{{ o.date }}</span>
            <span class="d-who">{{ o.who }}</span>
            <span class="d-status" :class="o.status === 'Parcial' ? 'partial' : 'none'">{{ o.status }}</span>
            <span class="d-missing">{{ o.missing.map((p: any) => `${p.qty} ${p.name}`).join(' · ') || '—' }}</span>
          </li>
        </ul>
      </div>
      <div class="destination-grid" v-if="Object.keys(rawStatsByDestRoundCategory).length > 0">
        <ProductionDestinationCard
          v-for="(rounds, destination) in rawStatsByDestRoundCategory"
          :key="destination"
          :destination="String(destination)"
          :rounds="rounds"
          :collapsed-keys="collapsedProductCategories"
          :selected="selectedRawProducts"
          @toggle-category="toggleProductCategory"
          @toggle-product="toggleRawProductSelection"
        />
      </div>

      <div v-else class="empty-raw">
        <i class="fas fa-folder-open"></i>
        <p>
          No hay pedidos
          <template v-if="sourceFilter !== 'all'"> de <strong>{{ sourceFilter === 'nicole' ? 'Nicole' : 'Sucree' }}</strong></template>
          en este periodo
        </p>
      </div>
    </div>

    <ProductionBatchBar
      :visible="selectedRawProducts.size > 0"
      :selected-count="selectedRawProducts.size"
      :is-processing="isBatchProcessing"
      @clear="clearRawSelection"
      @complete="openBatchConfirm"
    />

    <!-- Cantidades editables: piden 100, la cocina puede marcar que hará 20 -->
    <ProductionBatchModal
      :is-open="isBatchConfirmOpen"
      :rows="selectedRows"
      :quantities="batchQuantities"
      :is-processing="isBatchProcessing"
      @set-quantity="setBatchQuantity"
      @close="isBatchConfirmOpen = false"
      @confirm="handleBatchConfirm"
    />

    <ProductionExportModal
      :is-open="showExportModal"
      :is-loading="isExporting"
      :mode="exportMode"
      :destinations="exportDestinations"
      :selected-count="selectedProductNames.length"
      :preview-count="exportPreviewCount"
      @preview="updateExportPreview"
      @close="showExportModal = false"
      @confirm="handleExportConfirm"
    />
  </div>
</template>

<style lang="scss" scoped>
$font-stack-system: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

.summary-view {
  min-height: 100vh;
  background: #f8f9fa;
  color: #2c3e50;
  padding-bottom: 4rem;
  font-family: $font-stack-system;
  &.has-selection { padding-bottom: 7rem; }
}

.content-wrapper { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }

.delayed-alert { margin-bottom: 1rem; border-radius: 12px; overflow: hidden; border: 1px solid #fecaca; background: white; }
.delayed-band {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  background: #dc2626; color: white; border: none; padding: 0.75rem 1rem; font-weight: 800; font-size: 0.95rem; cursor: pointer; text-align: left;
  &:hover, &:focus-visible { background: #b91c1c; }
}
.delayed-list {
  list-style: none; margin: 0; padding: 0.4rem 1rem 0.7rem;
  li { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; padding: 0.45rem 0; border-bottom: 1px solid #fef2f2; font-size: 0.86rem; color: #334155; }
  li:last-child { border-bottom: none; }
  .d-date { font-weight: 800; color: #64748b; font-variant-numeric: tabular-nums; }
  .d-who { font-weight: 700; }
  .d-status { font-size: 0.72rem; font-weight: 800; padding: 1px 8px; border-radius: 10px; align-self: center;
    &.none { background: #fee2e2; color: #b91c1c; } &.partial { background: #fef3c7; color: #92400e; } }
  .d-missing { flex: 1 1 100%; color: #475569; }
}

.destination-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
  }
}

.empty-raw {
  padding: 6rem 2rem;
  text-align: center;
  color: #94a3b8;

  i { font-size: 4rem; margin-bottom: 1.5rem; opacity: 0.3; }
  p { font-size: 1.1rem; font-weight: 600; strong { color: #475569; } }

  .btn-see-all {
    margin-top: 1rem;
    background: #1e293b;
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    &:hover { background: #0f172a; }
  }
}

.loading-state,
.error-msg {
  padding: 4rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #7f8c8d;

  .loader {
    width: 32px; height: 32px; border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db; border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  button { background: #3498db; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
  i { font-size: 3rem; margin-bottom: 1rem; color: #bdc3c7; }
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
