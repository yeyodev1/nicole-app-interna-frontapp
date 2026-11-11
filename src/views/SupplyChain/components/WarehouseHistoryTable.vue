<script setup lang="ts">
import { ref, computed } from 'vue'
import WarehouseFilters from '@/components/SupplyChain/WarehouseFilters.vue'
import type { RawMaterial, Movement } from '@/types/warehouse'
import WarehouseService from '@/services/warehouse.service'
import { useToast } from '@/composables/useToast'
import * as XLSX from 'xlsx-js-style'
import { styleSimpleTable } from '@/utils/excelTheme'

interface AggEntry {
  _id: { type: string; receptionPoint: string }
  totalValue: number
  count: number
}

const props = defineProps<{
  materials: RawMaterial[]
  movements: Movement[]
  isLoading: boolean
  currentPage: number
  totalPages: number
  activeFilters: any
  aggregates: AggEntry[]
  receptionPoints: { name: string; isActive: boolean }[]
}>()

const emit = defineEmits(['filter', 'page-change'])

// ─── Aggregated Totals (all pages, whole period) ─────────────────────────────

const totalIn = computed(() => props.aggregates.filter(a => a._id.type === 'IN').reduce((s, a) => s + (a.totalValue || 0), 0))
const totalOut = computed(() => props.aggregates.filter(a => a._id.type === 'OUT').reduce((s, a) => s + (a.totalValue || 0), 0))
const totalLoss = computed(() => props.aggregates.filter(a => a._id.type === 'LOSS').reduce((s, a) => s + (a.totalValue || 0), 0))
const netValue = computed(() => totalIn.value - totalOut.value - totalLoss.value)

// ─── Per-Bodega Breakdown ─────────────────────────────────────────────────────

const byBodega = computed(() => {
  const map: Record<string, { in: number; out: number; loss: number; count: number }> = {}
  for (const a of props.aggregates) {
    const loc = a._id.receptionPoint
    if (!map[loc]) map[loc] = { in: 0, out: 0, loss: 0, count: 0 }
    if (a._id.type === 'IN') map[loc].in += a.totalValue || 0
    else if (a._id.type === 'OUT') map[loc].out += a.totalValue || 0
    else if (a._id.type === 'LOSS') map[loc].loss += a.totalValue || 0
    map[loc].count += a.count || 0
  }
  return Object.entries(map)
    .map(([name, vals]) => ({ name, ...vals, net: vals.in - vals.out - vals.loss }))
    .filter(b => b.name !== '__sin_bodega__' || b.count > 0)
    .sort((a, b) => b.in - a.in)
})

const hasBodegaBreakdown = computed(() => byBodega.value.length > 1 || (byBodega.value.length === 1 && byBodega.value[0]?.name !== '__sin_bodega__'))

// ─── Per-row value ────────────────────────────────────────────────────────────

const getMovementValue = (m: any) => m.totalValue || 0

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'lt'
  return unit
}

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return (quantity / 1000).toFixed(2)
  return quantity.toFixed(2)
}

const formatDate = (date: string | undefined) => {
  if (!date) return '-'
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(date))
}

const fmt = (n: number) => n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const handleFilter = (filters: any) => emit('filter', filters)
const changePage = (page: number) => emit('page-change', page)

// ─── Excel Export ────────────────────────────────────────────────────────────
const { success, error } = useToast()
const isExporting = ref(false)

const exportToExcel = async () => {
  if (isExporting.value) return
  isExporting.value = true
  try {
    const data = await WarehouseService.getMovements({ ...props.activeFilters, limit: 100000 })
    const allMovements = data.movements || []

    if (allMovements.length === 0) {
      error('No hay movimientos para exportar')
      return
    }

    const rows = allMovements.map((m: any) => {
      let origenDestino = '-'
      if (m.type === 'IN') origenDestino = m.provider?.name || '-'
      else if (m.type === 'LOSS') origenDestino = 'Pérdida Directa'
      else origenDestino = m.entity || '-'

      return {
        'Fecha': formatDate(m.date || m.createdAt),
        'Tipo': m.type === 'IN' ? 'ENTRADA' : m.type === 'OUT' ? 'SALIDA' : 'BAJA',
        'Bodega': m.receptionPoint || '-',
        'Materia Prima': m.rawMaterial?.name || 'Desconocido',
        'Cantidad': Number(getDisplayQuantity(m.quantity, m.rawMaterial?.unit)),
        'Unidad': getDisplayUnit(m.rawMaterial?.unit),
        'Valor Unitario ($)': m.unitCost || 0,
        'Valor Total ($)': getMovementValue(m),
        'Origen / Destino': origenDestino,
        'Responsable': m.responsible || '-',
        'Observación': m.observation || ''
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)

    // Formato común de los Excel de la app
    styleSimpleTable(ws, { numericCols: [4, 6, 7] })

    // Auto-size columns roughly based on header lengths vs typical content
    ws['!cols'] = [
      { wch: 20 }, // Fecha
      { wch: 10 }, // Tipo
      { wch: 15 }, // Bodega
      { wch: 30 }, // Materia
      { wch: 10 }, // Cantidad
      { wch: 8 },  // Unidad
      { wch: 15 }, // Unit
      { wch: 15 }, // Total
      { wch: 20 }, // Origen/Destino
      { wch: 15 }, // Responsable
      { wch: 35 }, // Obs
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
    XLSX.writeFile(wb, `Movimientos_Bodega_${new Date().toISOString().split('T')[0]}.xlsx`)
    success('Archivo Excel generado correctamente')
  } catch (err: any) {
    console.error(err)
    error('Error al exportar a Excel')
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="movements-tab">

    <!-- ─── Filters ───────────────────────────────────────────────────────── -->
    <WarehouseFilters
      :materials="materials"
      :receptionPoints="receptionPoints"
      :initialFilters="activeFilters"
      :isExporting="isExporting"
      @filter="handleFilter"
      @export="exportToExcel"
    />

    <!-- ─── Summary Cards ─────────────────────────────────────────────────── -->
    <div class="summary-cards" v-if="aggregates.length > 0">
      <div class="summary-card card-in">
        <div class="card-icon"><i class="fas fa-arrow-down"></i></div>
        <div class="card-body">
          <span class="card-label">Total Entradas</span>
          <span class="card-amount">${{ fmt(totalIn) }}</span>
        </div>
      </div>
      <div class="summary-card card-out">
        <div class="card-icon"><i class="fas fa-arrow-up"></i></div>
        <div class="card-body">
          <span class="card-label">Total Salidas</span>
          <span class="card-amount">${{ fmt(totalOut) }}</span>
        </div>
      </div>
      <div class="summary-card card-loss">
        <div class="card-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="card-body">
          <span class="card-label">Total Bajas</span>
          <span class="card-amount">${{ fmt(totalLoss) }}</span>
        </div>
      </div>
      <div class="summary-card card-net" :class="{ 'card-net--negative': netValue < 0 }">
        <div class="card-icon"><i class="fas fa-balance-scale"></i></div>
        <div class="card-body">
          <span class="card-label">Neto Período</span>
          <span class="card-amount">{{ netValue >= 0 ? '+' : '' }}${{ fmt(netValue) }}</span>
        </div>
      </div>
    </div>

    <!-- ─── Per-Bodega Breakdown ──────────────────────────────────────────── -->
    <div v-if="hasBodegaBreakdown" class="bodega-breakdown">
      <div class="breakdown-header">
        <span class="breakdown-title">
          <i class="fas fa-warehouse"></i> Por Bodega
        </span>
        <span class="breakdown-count">{{ byBodega.length }} {{ byBodega.length === 1 ? 'bodega' : 'bodegas' }}</span>
      </div>
      <div class="breakdown-grid">
        <div v-for="b in byBodega" :key="b.name" class="bodega-card" :class="{ 'has-loss': b.loss > 0 }">

          <!-- Name row -->
          <div class="bc-header">
            <div class="bc-name">
              <span class="bc-dot"></span>
              {{ b.name === '__sin_bodega__' ? 'Sin bodega asignada' : b.name }}
            </div>
            <div class="bc-net" :class="b.net >= 0 ? 'net-pos' : 'net-neg'">
              {{ b.net >= 0 ? '+' : '' }}${{ fmt(b.net) }}
            </div>
          </div>



          <!-- Metrics row -->
          <div class="bc-metrics">
            <div class="bc-metric bc-in" :title="'Entró: $' + fmt(b.in)">
              <span class="bc-metric-label"><i class="fas fa-arrow-down"></i> Entró</span>
              <span class="bc-metric-value">${{ fmt(b.in) }}</span>
            </div>
            <div class="bc-metric bc-out" :title="'Salió: $' + fmt(b.out)">
              <span class="bc-metric-label"><i class="fas fa-arrow-up"></i> Salió</span>
              <span class="bc-metric-value">${{ fmt(b.out) }}</span>
            </div>
            <div v-if="b.loss > 0" class="bc-metric bc-loss" :title="'Bajas: $' + fmt(b.loss)">
              <span class="bc-metric-label"><i class="fas fa-exclamation-triangle"></i> Bajas</span>
              <span class="bc-metric-value">${{ fmt(b.loss) }}</span>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- ─── Table ─────────────────────────────────────────────────────────── -->
    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>Cargando movimientos...</p>
    </div>

    <div v-else class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Materia Prima</th>
            <th class="text-right">Cantidad</th>
            <th class="text-right">Valor ($)</th>
            <th>Bodega</th>
            <th>Origen / Destino</th>
            <th>Responsable</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="movements.length === 0">
            <td colspan="8" class="text-center empty-cell">No hay movimientos registrados.</td>
          </tr>
          <tr v-for="m in movements" :key="m._id">
            <td class="date-cell">{{ formatDate(m.date || m.createdAt) }}</td>
            <td>
              <span class="badge" :class="{
                'badge-in': m.type === 'IN',
                'badge-out': m.type === 'OUT',
                'badge-loss': m.type === 'LOSS'
              }">
                {{ m.type === 'IN' ? 'ENTRADA' : m.type === 'OUT' ? 'SALIDA' : 'BAJA' }}
              </span>
            </td>
            <td class="material-cell">{{ m.rawMaterial?.name || 'Desconocido' }}</td>
            <td class="text-right fw-600">
              {{ getDisplayQuantity(m.quantity, m.rawMaterial?.unit) }}
              <span class="unit-text">{{ getDisplayUnit(m.rawMaterial?.unit) }}</span>
            </td>
            <td class="text-right money-cell" :class="{ 'in-value': m.type === 'IN', 'loss-value': m.type === 'LOSS' }">
              <span v-if="m.type === 'IN'">+ ${{ fmt(getMovementValue(m)) }}</span>
              <span v-else-if="m.type === 'LOSS'">- ${{ fmt(getMovementValue(m)) }}</span>
              <span v-else class="text-muted">- ${{ fmt(getMovementValue(m)) }}</span>
            </td>
            <td>
              <span v-if="m.receptionPoint" class="bodega-tag">
                <i class="fas fa-warehouse"></i> {{ m.receptionPoint }}
              </span>
              <span v-else class="text-muted-sm">—</span>
            </td>
            <td>
              <span v-if="m.type === 'IN'">{{ m.provider?.name || '-' }}</span>
              <span v-else-if="m.type === 'LOSS'">Pérdida Directa</span>
              <span v-else>{{ m.entity || '-' }}</span>
            </td>
            <td>
              <span class="responsible-tag">
                <i class="fas fa-user-tag"></i> {{ m.responsible || '-' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination" v-if="totalPages > 1">
        <button :disabled="currentPage === 1" @click="changePage(currentPage - 1)">Anterior</button>
        <span>Página {{ currentPage }} de {{ totalPages }}</span>
        <button :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">Siguiente</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// ─── Summary Cards (mobile-first) ──────────────────────────────────────────────

.summary-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.65rem;
  margin-bottom: 1.25rem;

  @media (min-width: 640px) {
    gap: 0.9rem;
    margin-bottom: 1.5rem;
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  border-radius: 12px;
  padding: 0.9rem 1rem;
  border: 1px solid $border-light;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  min-height: 72px;
  overflow: hidden;

  @media (min-width: 640px) {
    gap: 1rem;
    padding: 1.1rem 1.25rem;
    min-height: auto;
  }

  @media (min-width: 1024px) {
    padding: 1.25rem 1.5rem;
  }

  .card-icon {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    flex-shrink: 0;

    @media (min-width: 640px) {
      width: 42px;
      height: 42px;
      font-size: 1.05rem;
      border-radius: 10px;
    }
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0; // prevent overflow
  }

  .card-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    @media (min-width: 640px) {
      font-size: 0.75rem;
      letter-spacing: 0.5px;
    }
  }

  .card-amount {
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: -0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    @media (min-width: 640px) {
      font-size: 1.2rem;
    }

    @media (min-width: 1024px) {
      font-size: 1.35rem;
      letter-spacing: -0.5px;
    }
  }

  &.card-in {
    border-left: 3px solid #059669;

    .card-icon {
      background: #d1fae5;
      color: #059669;
    }

    .card-label {
      color: #059669;
    }

    .card-amount {
      color: #065f46;
    }
  }

  &.card-out {
    border-left: 3px solid #dc2626;

    .card-icon {
      background: #fee2e2;
      color: #dc2626;
    }

    .card-label {
      color: #dc2626;
    }

    .card-amount {
      color: #991b1b;
    }
  }

  &.card-loss {
    border-left: 3px solid #d97706;

    .card-icon {
      background: #fef3c7;
      color: #d97706;
    }

    .card-label {
      color: #d97706;
    }

    .card-amount {
      color: #92400e;
    }
  }

  &.card-net {
    border-left: 3px solid $NICOLE-PURPLE;

    .card-icon {
      background: rgba($NICOLE-PURPLE, 0.1);
      color: $NICOLE-PURPLE;
    }

    .card-label {
      color: $NICOLE-PURPLE;
    }

    .card-amount {
      color: $NICOLE-PURPLE;
    }

    &.card-net--negative {
      border-left-color: #dc2626;

      .card-icon {
        background: #fee2e2;
        color: #dc2626;
      }

      .card-label {
        color: #dc2626;
      }

      .card-amount {
        color: #991b1b;
      }
    }
  }
}

// ─── Per-Bodega Breakdown (mobile-first) ───────────────────────────────────────

.bodega-breakdown {
  background: white;
  border-radius: 14px;
  border: 1px solid $border-light;
  padding: 1rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);

  @media (min-width: 640px) {
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.5rem;
  }
}

.breakdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;

  @media (min-width: 640px) {
    margin-bottom: 1.1rem;
  }
}

.breakdown-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: $text-light;
  text-transform: uppercase;
  letter-spacing: 0.6px;

  i {
    color: $NICOLE-PURPLE;
    font-size: 0.85rem;
  }

  @media (min-width: 640px) {
    font-size: 0.85rem;
  }
}

.breakdown-count {
  font-size: 0.72rem;
  font-weight: 600;
  color: $text-light;
  background: $gray-50;
  border: 1px solid $border-light;
  border-radius: 20px;
  padding: 0.2rem 0.65rem;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.6rem;

  @media (min-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.8rem;
  }
}

// ─── Bodega Card ───────────────────────────────────────────────────────────────

.bodega-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.9rem;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: box-shadow 0.15s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.07);
  }

  &.has-loss {
    border-color: #fde68a;
    background: #fffdf5;
  }

  @media (min-width: 640px) {
    padding: 1.1rem;
  }
}

// Header row: name + net
.bc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.bc-name {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: $text-dark;
  line-height: 1.3;
  min-width: 0;
  flex: 1;

  @media (min-width: 640px) {
    font-size: 0.88rem;
  }
}

.bc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $NICOLE-PURPLE;
  flex-shrink: 0;
}

.bc-net {
  font-size: 0.9rem;
  font-weight: 800;
  white-space: nowrap;
  letter-spacing: -0.3px;
  flex-shrink: 0;

  &.net-pos {
    color: #059669;
  }

  &.net-neg {
    color: #dc2626;
  }

  @media (min-width: 640px) {
    font-size: 1rem;
  }
}

// Progress bar: shows consumed % of stock
.bc-bar {
  height: 5px;
  background: #e2e8f0;
  border-radius: 99px;
  overflow: hidden;
}

.bc-bar-fill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, #059669, #dc2626);
  transition: width 0.4s ease;
  min-width: 2px;
}

// Metrics row: in / out / loss chips
.bc-metrics {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.bc-metric {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  flex: 1;
  min-width: fit-content;

  .bc-metric-label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;

    i {
      font-size: 0.6rem;
    }
  }

  .bc-metric-value {
    font-size: 0.88rem;
    font-weight: 800;
    white-space: nowrap;
    letter-spacing: -0.2px;

    @media (min-width: 640px) {
      font-size: 0.95rem;
    }
  }

  &.bc-in {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;

    .bc-metric-label {
      color: #059669;

      i {
        color: #059669;
      }
    }

    .bc-metric-value {
      color: #065f46;
    }
  }

  &.bc-out {
    background: #fff5f5;
    border: 1px solid #fecaca;

    .bc-metric-label {
      color: #dc2626;

      i {
        color: #dc2626;
      }
    }

    .bc-metric-value {
      color: #991b1b;
    }
  }

  &.bc-loss {
    background: #fffbeb;
    border: 1px solid #fde68a;

    .bc-metric-label {
      color: #d97706;

      i {
        color: #d97706;
      }
    }

    .bc-metric-value {
      color: #92400e;
    }
  }
}

// ─── Loading ───────────────────────────────────────────────────────────────────

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: $text-light;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba($NICOLE-PURPLE, 0.2);
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// ─── Table ─────────────────────────────────────────────────────────────────────

.table-responsive {
  overflow-x: auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid $border-light;
}

.table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 0.9rem 1rem;
    text-align: left;
    border-bottom: 1px solid $border-light;
  }

  th {
    background: $gray-50;
    font-weight: 600;
    color: $text-light;
    font-size: 0.85rem;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover {
    background: #fafafa;
  }
}

.date-cell {
  font-size: 0.85rem;
  color: $text-light;
  white-space: nowrap;
}

.material-cell {
  font-weight: 600;
}

.empty-cell {
  color: $text-light;
  padding: 3rem !important;
  text-align: center;
}

.badge {
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;

  &.badge-in {
    background: #d1fae5;
    color: #047857;
  }

  &.badge-out {
    background: #fee2e2;
    color: #c53030;
  }

  &.badge-loss {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fee2e2;
  }
}

.text-right {
  text-align: right !important;
}

.fw-600 {
  font-weight: 600;
}

.unit-text {
  font-size: 0.8rem;
  color: $text-light;
  margin-left: 2px;
  text-transform: lowercase;
}

.money-cell {
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;

  &.in-value {
    color: #047857;
    font-weight: 700;
  }

  &.loss-value {
    color: #991b1b;
    font-weight: 600;
  }
}

.bodega-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #5b21b6;
  background: rgba($NICOLE-PURPLE, 0.08);
  padding: 0.2rem 0.55rem;
  border-radius: 6px;

  i {
    font-size: 0.7rem;
  }
}

.responsible-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;

  i {
    font-size: 0.7rem;
    color: $NICOLE-PURPLE;
  }
}

.text-muted {
  color: $text-light;
}

.text-muted-sm {
  color: #cbd5e1;
  font-size: 1rem;
}

// ─── Pagination ────────────────────────────────────────────────────────────────

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid $border-light;

  button {
    padding: 0.5rem 1rem;
    border: 1px solid $border-light;
    background: white;
    border-radius: 6px;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      background: $gray-50;
    }
  }
}
</style>
