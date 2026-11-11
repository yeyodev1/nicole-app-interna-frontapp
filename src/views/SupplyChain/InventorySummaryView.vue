<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import RawMaterialService from '@/services/raw-material.service'
import WarehouseSettingsService from '@/services/warehouse-settings.service'
import { useToast } from '@/composables/useToast'
import SupplierOrderModal from '@/components/SupplyChain/SupplierOrderModal.vue'

// @ts-ignore
import XLSX from 'xlsx-js-style'
import { styleSimpleTable } from '@/utils/excelTheme'

const { error: showError, success } = useToast()

const materials = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const expandedSections = ref({
  low: true,
  warning: true,
  optimal: true,
  overstock: false
})

// Supplier Order Modal State
const isOrderModalOpen = ref(false)
const selectedOrderProvider = ref<any>(null)
const selectedMaterialId = ref('')

const receptionPoints = ref<{ _id?: string; name: string; isActive: boolean }[]>([])
const selectedReceptionPoint = ref('')

const fetchSettings = async () => {
  try {
    const data = await WarehouseSettingsService.getSettings()
    receptionPoints.value = data.receptionPoints.filter(p => p.isActive)
  } catch (err) {
    console.error('Error fetching settings', err)
  }
}

const openOrderModal = (m: any) => {
  if (!m.provider) {
    showError('Este insumo no tiene un proveedor asignado.')
    return
  }
  selectedOrderProvider.value = m.provider
  selectedMaterialId.value = m._id
  isOrderModalOpen.value = true
}

const fetchData = async () => {
  isLoading.value = true
  try {
    materials.value = await RawMaterialService.getRawMaterials(undefined, undefined, undefined, selectedReceptionPoint.value)
  } catch (err) {
    showError('Error al cargar datos de inventario')
  } finally {
    isLoading.value = false
  }
}

watch(selectedReceptionPoint, () => {
  fetchData()
})

const getDisplayUnit = (unit: string) => {
  if (unit === 'g') return 'kg'
  if (unit === 'ml') return 'lt'
  return unit
}

const getDisplayQuantity = (quantity: number, unit: string) => {
  if (unit === 'g' || unit === 'ml') return (quantity / 1000).toFixed(2)
  return quantity.toFixed(2)
}

type Status = 'low' | 'warning' | 'optimal' | 'overstock'

const getStockStatus = (m: any): Status => {
  const current = m.quantity || 0
  const min = m.minStock || 0
  const max = m.maxStock || 0

  if (current === 0) return 'low'
  if (min === 0 && max === 0) return 'optimal'
  if (max > 0 && current > max) return 'overstock'
  if (current < min) return 'low'
  if (current >= min && current < min * 1.5) return 'warning'
  return 'optimal'
}

const filteredMaterials = computed(() => {
  if (!searchQuery.value) return materials.value
  const query = searchQuery.value.toLowerCase()
  return materials.value.filter(m =>
    m.name.toLowerCase().includes(query) ||
    (m.code && m.code.toLowerCase().includes(query)) ||
    (m.category && m.category.toLowerCase().includes(query))
  )
})

const itemsByStatus = computed(() => {
  const groups: Record<Status, any[]> = { low: [], warning: [], optimal: [], overstock: [] }
  filteredMaterials.value.forEach(m => {
    groups[getStockStatus(m)].push(m)
  })
  return groups
})

const stats = computed(() => ({
  total: materials.value.length,
  low: itemsByStatus.value.low.length,
  warning: itemsByStatus.value.warning.length,
  optimal: itemsByStatus.value.optimal.length,
  overstock: itemsByStatus.value.overstock.length
}))

const toggleSection = (section: Status) => {
  expandedSections.value[section] = !expandedSections.value[section]
}

const exportToExcel = () => {
  if (materials.value.length === 0) return

  const data = materials.value.map(m => {
    const unitCost = m.cost || 0
    const totalValue = (m.quantity || 0) * unitCost
    return {
      'Proveedor': m.provider?.name || (typeof m.provider === 'string' ? '...' : 'N/A'),
      'Categoría': m.category || 'N/A',
      'Subcategoría (Ítem)': m.item || '-',
      'Materia Prima': m.name,
      'Código': m.code || '-',
      'Cantidad': parseFloat(getDisplayQuantity(m.quantity || 0, m.unit)),
      'Unidad': getDisplayUnit(m.unit).toUpperCase(),
      'Costo Unitario ($)': unitCost,
      'Valor Total ($)': totalValue
    }
  })

  const ws = XLSX.utils.json_to_sheet(data)
  const range = XLSX.utils.decode_range(ws['!ref']!)
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    for (const C of [5, 7, 8]) {
      const cell_ref = XLSX.utils.encode_cell({ c: C, r: R })
      if (ws[cell_ref]) ws[cell_ref].z = '#,##0.00'
    }
  }
  // Formato común de los Excel de la app
  styleSimpleTable(ws, { numericCols: [5, 7, 8], boldCols: [8] })
  ws['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 35 },
    { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 15 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Estado de Bodega")
  XLSX.writeFile(wb, `Inventario_Nicole_${new Date().toISOString().split('T')[0]}.xlsx`)
  success('Archivo Excel generado correctamente')
}

onMounted(async () => {
  await fetchSettings()
  fetchData()
})
</script>

<template>
  <div class="inventory-summary">
    <div class="content-container">

      <!-- Header -->
      <div class="header">
        <div class="title-section">
          <h1>Centro de Control de Inventario</h1>
          <p>Monitoreo predictivo de stock y reabastecimiento</p>
        </div>
        <div class="actions-bar">
          <div class="search-box">
            <i class="fas fa-search"></i>
            <input v-model="searchQuery" placeholder="Buscar insumo..." type="text" />
            <button v-if="searchQuery" class="clear-search" @click="searchQuery = ''">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <select v-model="selectedReceptionPoint" class="filter-select">
            <option value="">Bodega General</option>
            <option v-for="pt in receptionPoints" :key="pt.name" :value="pt.name">{{ pt.name }}</option>
          </select>
          <router-link to="/supply-chain/orders" class="btn-action">
            <i class="fas fa-clipboard-list"></i>
            <span>Historial</span>
          </router-link>
          <button class="btn-action btn-export" @click="exportToExcel">
            <i class="fas fa-file-excel"></i>
            <span>Exportar</span>
          </button>
          <button class="btn-action btn-refresh" @click="fetchData" :disabled="isLoading">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
            <span>Sincronizar</span>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Calculando niveles de inventario...</span>
      </div>

      <!-- Empty onboarding state -->
      <div v-else-if="materials.length === 0" class="onboarding">
        <div class="onboarding-hero">
          <div class="hero-icon"><i class="fas fa-warehouse"></i></div>
          <h2>Tu bodega está vacía</h2>
          <p>Para comenzar a gestionar tu inventario, sigue estos tres pasos:</p>
        </div>
        <div class="steps">
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-icon"><i class="fas fa-truck"></i></div>
            <div class="step-body">
              <strong>Crea un Proveedor</strong>
              <span>Registra los datos del proveedor: RUC, teléfono, correo y dirección.</span>
            </div>
            <router-link to="/supply-chain/providers" class="step-btn">
              Ir a Proveedores <i class="fas fa-arrow-right"></i>
            </router-link>
          </div>
          <div class="step-arrow"><i class="fas fa-chevron-right"></i></div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-icon"><i class="fas fa-box"></i></div>
            <div class="step-body">
              <strong>Agrega Materias Primas</strong>
              <span>Desde el perfil del proveedor, en la sección "Portafolio", crea las materias primas.</span>
            </div>
            <router-link to="/supply-chain/providers" class="step-btn">
              Ir a Proveedores <i class="fas fa-arrow-right"></i>
            </router-link>
          </div>
          <div class="step-arrow"><i class="fas fa-chevron-right"></i></div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-icon"><i class="fas fa-chart-bar"></i></div>
            <div class="step-body">
              <strong>Monitorea tu Inventario</strong>
              <span>Aquí verás el estado de stock de cada producto en tiempo real.</span>
            </div>
            <span class="step-btn disabled">Pendiente de datos</span>
          </div>
        </div>
        <div class="onboarding-tip">
          <i class="fas fa-lightbulb"></i>
          <span>Tip: También puedes crear <router-link to="/supply-chain/categories">Categorías</router-link> para organizar mejor tus materias primas antes de comenzar.</span>
        </div>
      </div>

      <!-- Dashboard -->
      <div v-else class="dashboard">

        <!-- Stats Row -->
        <div class="summary-cards">
          <div class="stat-card stat-low" @click="toggleSection('low')">
            <div class="stat-icon"><i class="fas fa-exclamation-circle"></i></div>
            <div class="stat-body">
              <span class="stat-value">{{ stats.low }}</span>
              <span class="stat-label">Críticos</span>
            </div>
            <div class="stat-bar" :class="{ active: expandedSections.low }"></div>
          </div>

          <div class="stat-card stat-warning" @click="toggleSection('warning')">
            <div class="stat-icon"><i class="fas fa-tachometer-alt"></i></div>
            <div class="stat-body">
              <span class="stat-value">{{ stats.warning }}</span>
              <span class="stat-label">En Alerta</span>
            </div>
            <div class="stat-bar" :class="{ active: expandedSections.warning }"></div>
          </div>

          <div class="stat-card stat-optimal" @click="toggleSection('optimal')">
            <div class="stat-icon"><i class="fas fa-shield-alt"></i></div>
            <div class="stat-body">
              <span class="stat-value">{{ stats.optimal }}</span>
              <span class="stat-label">Óptimos</span>
            </div>
            <div class="stat-bar" :class="{ active: expandedSections.optimal }"></div>
          </div>

          <div class="stat-card stat-overstock" @click="toggleSection('overstock')">
            <div class="stat-icon"><i class="fas fa-boxes"></i></div>
            <div class="stat-body">
              <span class="stat-value">{{ stats.overstock }}</span>
              <span class="stat-label">Sobrestock</span>
            </div>
            <div class="stat-bar" :class="{ active: expandedSections.overstock }"></div>
          </div>
        </div>

        <!-- Accordion Sections: rojo → amarillo → verde → azul -->
        <div class="accordion-layout">

          <!-- CRITICO -->
          <div class="accordion-group low" :class="{ open: expandedSections.low }">
            <button class="accordion-header" @click="toggleSection('low')">
              <div class="title-group">
                <i class="fas fa-exclamation-circle main-icon"></i>
                <h2>CRITICO — ABAJO DEL MINIMO</h2>
                <span class="count-badge">{{ stats.low }}</span>
              </div>
              <i class="fas fa-chevron-down arrow"></i>
            </button>
            <div class="accordion-content">
              <div v-if="itemsByStatus.low.length === 0" class="empty-msg">
                <i class="fas fa-check-double"></i>
                No hay insumos críticos por el momento.
              </div>
              <div v-else class="grid-display">
                <div v-for="m in itemsByStatus.low" :key="m._id" class="inv-card style-low">
                  <div class="card-header">
                    <div class="card-meta">
                      <span class="card-cat">{{ m.category || 'Sin categoría' }}</span>
                      <h3 class="card-name">{{ m.name }}</h3>
                      <span v-if="m.provider?.name" class="card-provider">
                        <i class="fas fa-truck"></i> {{ m.provider.name }}
                      </span>
                    </div>
                    <div class="status-dot dot-low shine"></div>
                  </div>
                  <div class="progress-section">
                    <div class="progress-labels">
                      <span>Stock actual</span>
                      <span class="progress-qty">{{ getDisplayQuantity(m.quantity, m.unit) }} {{ getDisplayUnit(m.unit) }}</span>
                    </div>
                    <div class="progress-track">
                      <div
                        class="progress-fill fill-low"
                        :style="{ width: Math.min((m.quantity / (m.minStock || 1)) * 100, 100) + '%' }"
                      ></div>
                    </div>
                    <div class="progress-hint">Mínimo: {{ getDisplayQuantity(m.minStock || 0, m.unit) }} {{ getDisplayUnit(m.unit) }}</div>
                  </div>
                  <div v-if="m.provider" class="card-footer">
                    <button class="btn-order" @click="openOrderModal(m)">
                      <i class="fas fa-truck"></i> Realizar Pedido
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ALERTA -->
          <div class="accordion-group warning" :class="{ open: expandedSections.warning }">
            <button class="accordion-header" @click="toggleSection('warning')">
              <div class="title-group">
                <i class="fas fa-exclamation-triangle main-icon"></i>
                <h2>ALERTA — REABASTECIMIENTO PROXIMO</h2>
                <span class="count-badge">{{ stats.warning }}</span>
              </div>
              <i class="fas fa-chevron-down arrow"></i>
            </button>
            <div class="accordion-content">
              <div v-if="itemsByStatus.warning.length === 0" class="empty-msg">
                <i class="fas fa-check"></i>
                No hay alertas de reabastecimiento.
              </div>
              <div v-else class="grid-display">
                <div v-for="m in itemsByStatus.warning" :key="m._id" class="inv-card style-warning">
                  <div class="card-header">
                    <div class="card-meta">
                      <span class="card-cat">{{ m.category || 'Sin categoría' }}</span>
                      <h3 class="card-name">{{ m.name }}</h3>
                      <span v-if="m.provider?.name" class="card-provider">
                        <i class="fas fa-truck"></i> {{ m.provider.name }}
                      </span>
                    </div>
                    <div class="status-dot dot-warning"></div>
                  </div>
                  <div class="stock-comparison">
                    <div class="cmp-block">
                      <span class="cmp-label">Actual</span>
                      <span class="cmp-value">{{ getDisplayQuantity(m.quantity, m.unit) }} {{ getDisplayUnit(m.unit) }}</span>
                    </div>
                    <i class="fas fa-arrow-right cmp-arrow"></i>
                    <div class="cmp-block">
                      <span class="cmp-label">Mínimo</span>
                      <span class="cmp-value">{{ getDisplayQuantity(m.minStock || 0, m.unit) }} {{ getDisplayUnit(m.unit) }}</span>
                    </div>
                  </div>
                  <div v-if="m.provider" class="card-footer">
                    <button class="btn-order" @click="openOrderModal(m)">
                      <i class="fas fa-truck"></i> Realizar Pedido
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- OPTIMO -->
          <div class="accordion-group optimal" :class="{ open: expandedSections.optimal }">
            <button class="accordion-header" @click="toggleSection('optimal')">
              <div class="title-group">
                <i class="fas fa-shield-alt main-icon"></i>
                <h2>OPTIMO — STOCK SALUDABLE</h2>
                <span class="count-badge">{{ stats.optimal }}</span>
              </div>
              <i class="fas fa-chevron-down arrow"></i>
            </button>
            <div class="accordion-content">
              <div v-if="itemsByStatus.optimal.length === 0" class="empty-msg">
                <i class="fas fa-info-circle"></i>
                No hay insumos en nivel óptimo.
              </div>
              <div v-else class="grid-display">
                <div v-for="m in itemsByStatus.optimal" :key="m._id" class="inv-card style-optimal">
                  <div class="card-header">
                    <div class="card-meta">
                      <span class="card-cat">{{ m.category || 'Sin categoría' }}</span>
                      <h3 class="card-name">{{ m.name }}</h3>
                      <span v-if="m.provider?.name" class="card-provider">
                        <i class="fas fa-truck"></i> {{ m.provider.name }}
                      </span>
                    </div>
                    <div class="status-dot dot-optimal"></div>
                  </div>
                  <div class="stock-comparison">
                    <div class="cmp-block">
                      <span class="cmp-label">Actual</span>
                      <span class="cmp-value cmp-green">{{ getDisplayQuantity(m.quantity, m.unit) }} {{ getDisplayUnit(m.unit) }}</span>
                    </div>
                    <i class="fas fa-check cmp-arrow cmp-arrow-green"></i>
                    <div class="cmp-block">
                      <span class="cmp-label">Máximo</span>
                      <span class="cmp-value">{{ m.maxStock ? getDisplayQuantity(m.maxStock, m.unit) : '—' }} {{ m.maxStock ? getDisplayUnit(m.unit) : '' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- SOBRESTOCK -->
          <div class="accordion-group overstock" :class="{ open: expandedSections.overstock }">
            <button class="accordion-header" @click="toggleSection('overstock')">
              <div class="title-group">
                <i class="fas fa-boxes main-icon"></i>
                <h2>SOBRESTOCK — EXCEDE EL MAXIMO</h2>
                <span class="count-badge">{{ stats.overstock }}</span>
              </div>
              <i class="fas fa-chevron-down arrow"></i>
            </button>
            <div class="accordion-content">
              <div v-if="itemsByStatus.overstock.length === 0" class="empty-msg">
                <i class="fas fa-check-circle"></i>
                Ningún insumo excede su nivel máximo.
              </div>
              <div v-else class="grid-display">
                <div v-for="m in itemsByStatus.overstock" :key="m._id" class="inv-card style-overstock">
                  <div class="card-header">
                    <div class="card-meta">
                      <span class="card-cat">{{ m.category || 'Sin categoría' }}</span>
                      <h3 class="card-name">{{ m.name }}</h3>
                      <span v-if="m.provider?.name" class="card-provider">
                        <i class="fas fa-truck"></i> {{ m.provider.name }}
                      </span>
                    </div>
                    <div class="status-dot dot-overstock"></div>
                  </div>
                  <div class="stock-comparison">
                    <div class="cmp-block">
                      <span class="cmp-label">Actual</span>
                      <span class="cmp-value cmp-blue">{{ getDisplayQuantity(m.quantity, m.unit) }} {{ getDisplayUnit(m.unit) }}</span>
                    </div>
                    <i class="fas fa-arrow-up cmp-arrow cmp-arrow-blue"></i>
                    <div class="cmp-block">
                      <span class="cmp-label">Máximo</span>
                      <span class="cmp-value">{{ getDisplayQuantity(m.maxStock, m.unit) }} {{ getDisplayUnit(m.unit) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <SupplierOrderModal
      :is-open="isOrderModalOpen"
      :provider="selectedOrderProvider"
      :all-materials="materials"
      :initial-material-id="selectedMaterialId"
      @close="isOrderModalOpen = false"
    />
  </div>
</template>

<style lang="scss" scoped>
.inventory-summary {
  width: 100%;
  min-height: 100vh;
  background-color: var(--color-background);
}

.content-container {
  padding: 1.5rem 1rem;

  @media (min-width: 768px) {
    padding: 2.5rem 2rem;
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────

.header {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 2.5rem;

  @media (min-width: 900px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 800;
    color: #1e1b4b;
    margin: 0;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;

    @media (min-width: 640px) {
      font-size: 2.25rem;
    }
  }

  p {
    font-size: 0.95rem;
    color: #64748b;
    margin: 0.4rem 0 0;
    font-weight: 500;
  }
}

.actions-bar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 260px;

  i.fa-search {
    position: absolute;
    left: 0.9rem;
    color: #94a3b8;
    pointer-events: none;
    font-size: 0.85rem;
  }

  input {
    width: 100%;
    padding: 0.7rem 1rem 0.7rem 2.4rem;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    font-size: 0.9rem;
    background: white;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: #4338ca;
      box-shadow: 0 0 0 3px rgba(67, 56, 202, 0.1);
    }
  }

  .clear-search {
    position: absolute;
    right: 0.6rem;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.2rem;
    font-size: 0.8rem;

    &:hover {
      color: #ef4444;
    }
  }
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.25rem;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  color: #475569;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    transform: translateY(-1px);
  }

  &.btn-export {
    color: #10b981;

    &:hover {
      background: #10b981;
      color: white;
      border-color: #10b981;
    }
  }

  &.btn-refresh {
    color: #4338ca;

    &:hover {
      background: #4338ca;
      color: white;
      border-color: #4338ca;
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;

    &:hover {
      transform: none;
    }
  }
}

.filter-select {
  padding: 0.7rem 1.25rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  font-size: 0.88rem;
  font-weight: 600;
  color: #475569;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem top 50%;
  background-size: 0.65rem auto;
  padding-right: 2.5rem;

  &:hover {
    border-color: #cbd5e1;
    background-color: #f8fafc;
  }

  &:focus {
    outline: none;
    border-color: #4338ca;
    box-shadow: 0 0 0 3px rgba(67, 56, 202, 0.1);
  }
}

// ─── Loading ──────────────────────────────────────────────────────────────────

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rem;
  gap: 1.25rem;
  color: #64748b;
  font-weight: 600;

  .spinner {
    width: 3rem;
    height: 3rem;
    border: 4px solid #e2e8f0;
    border-top-color: #4338ca;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

.onboarding {
  padding: 2rem 0 4rem;
}

.onboarding-hero {
  text-align: center;
  margin-bottom: 3rem;

  .hero-icon {
    width: 80px;
    height: 80px;
    background: rgba($NICOLE-PURPLE, 0.08);
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    color: $NICOLE-PURPLE;
    margin: 0 auto 1.5rem;
  }

  h2 {
    font-size: 1.75rem;
    font-weight: 900;
    color: #1e293b;
    margin: 0 0 0.5rem;
  }

  p {
    color: #64748b;
    font-size: 1rem;
    font-weight: 500;
    margin: 0;
  }
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (min-width: 768px) {
    flex-direction: row;
    gap: 0;
    align-items: flex-start;
  }
}

.step-arrow {
  display: none;
  color: #cbd5e1;
  font-size: 1.25rem;
  flex-shrink: 0;

  @media (min-width: 768px) {
    display: flex;
    align-items: center;
    padding: 0 0.5rem;
    margin-top: 40px;
  }
}

.step {
  flex: 1;
  background: white;
  border-radius: 20px;
  border: 2px solid #f1f5f9;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  transition: all 0.2s;

  &:hover {
    border-color: rgba($NICOLE-PURPLE, 0.3);
    box-shadow: 0 8px 24px rgba($NICOLE-PURPLE, 0.06);
  }

  .step-num {
    position: absolute;
    top: -14px;
    left: 1.5rem;
    width: 28px;
    height: 28px;
    background: $NICOLE-PURPLE;
    color: white;
    border-radius: 50%;
    font-size: 0.8rem;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .step-icon {
    width: 48px;
    height: 48px;
    background: rgba($NICOLE-PURPLE, 0.08);
    color: $NICOLE-PURPLE;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
  }

  .step-body {
    flex: 1;

    strong {
      display: block;
      font-size: 1rem;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 0.4rem;
    }

    span {
      font-size: 0.85rem;
      color: #64748b;
      font-weight: 500;
      line-height: 1.5;
    }
  }

  .step-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.1rem;
    border-radius: 12px;
    background: $NICOLE-PURPLE;
    color: white;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s;
    align-self: flex-start;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 12px rgba($NICOLE-PURPLE, 0.25);
    }

    &.disabled {
      background: #f1f5f9;
      color: #94a3b8;
      cursor: default;

      &:hover {
        transform: none;
        box-shadow: none;
      }
    }
  }
}

.onboarding-tip {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-top: 2rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 16px;
  padding: 1rem 1.25rem;
  font-size: 0.88rem;
  color: #92400e;
  font-weight: 500;

  i {
    color: #f59e0b;
    margin-top: 2px;
    flex-shrink: 0;
  }

  a {
    color: $NICOLE-PURPLE;
    font-weight: 700;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

.summary-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;

  @media (min-width: 640px) {
    grid-template-columns: repeat(4, 1fr);
  }

  @media (min-width: 900px) {
    gap: 1.25rem;
    margin-bottom: 2.5rem;
  }
}

.stat-card {
  background: white;
  border-radius: 18px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid #f1f5f9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.25s;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  }

  .stat-icon {
    width: 3rem;
    height: 3rem;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .stat-body {
    display: flex;
    flex-direction: column;

    .stat-value {
      font-size: 2rem;
      font-weight: 900;
      line-height: 1;
    }

    .stat-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 0.2rem;
    }
  }

  .stat-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    width: 0;
    transition: width 0.5s ease;

    &.active {
      width: 100%;
    }
  }

  &.stat-low {
    .stat-icon {
      background: #fee2e2;
      color: #ef4444;
    }

    .stat-value {
      color: #ef4444;
    }

    .stat-bar {
      background: #ef4444;
    }
  }

  &.stat-warning {
    .stat-icon {
      background: #fef3c7;
      color: #d97706;
    }

    .stat-value {
      color: #d97706;
    }

    .stat-bar {
      background: #d97706;
    }
  }

  &.stat-optimal {
    .stat-icon {
      background: #dcfce7;
      color: #10b981;
    }

    .stat-value {
      color: #10b981;
    }

    .stat-bar {
      background: #10b981;
    }
  }

  &.stat-overstock {
    .stat-icon {
      background: #dbeafe;
      color: #3b82f6;
    }

    .stat-value {
      color: #3b82f6;
    }

    .stat-bar {
      background: #3b82f6;
    }
  }
}

// ─── Accordion ────────────────────────────────────────────────────────────────

.accordion-layout {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.accordion-group {
  background: white;
  border-radius: 18px;
  border: 1px solid #f1f5f9;
  overflow: hidden;
  transition: box-shadow 0.3s;

  .accordion-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    background: white;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;

    &:hover {
      background: #f8fafc;
    }

    .title-group {
      display: flex;
      align-items: center;
      gap: 1rem;

      .main-icon {
        font-size: 1.1rem;
      }

      h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: 0.3px;
      }

      .count-badge {
        padding: 0.2rem 0.65rem;
        border-radius: 99px;
        font-size: 0.78rem;
        font-weight: 800;
      }
    }

    .arrow {
      font-size: 0.9rem;
      color: #94a3b8;
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
    }
  }

  .accordion-content {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    padding: 0 1.5rem;
    transition: max-height 0.4s cubic-bezier(1, 0, 0, 1), opacity 0.3s, padding 0.3s;
  }

  &.open {
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.07);

    .accordion-content {
      max-height: 3000px;
      opacity: 1;
      padding: 0 1.5rem 2rem;
    }

    .arrow {
      transform: rotate(180deg);
    }
  }

  &.low {
    border-left: 5px solid #ef4444;

    .main-icon,
    h2 {
      color: #dc2626;
    }

    .count-badge {
      background: #fee2e2;
      color: #dc2626;
    }
  }

  &.warning {
    border-left: 5px solid #f59e0b;

    .main-icon,
    h2 {
      color: #b45309;
    }

    .count-badge {
      background: #fef3c7;
      color: #b45309;
    }
  }

  &.optimal {
    border-left: 5px solid #10b981;

    .main-icon,
    h2 {
      color: #047857;
    }

    .count-badge {
      background: #dcfce7;
      color: #047857;
    }
  }

  &.overstock {
    border-left: 5px solid #3b82f6;

    .main-icon,
    h2 {
      color: #1d4ed8;
    }

    .count-badge {
      background: #dbeafe;
      color: #1d4ed8;
    }
  }
}

// ─── Inventory Cards ──────────────────────────────────────────────────────────

.grid-display {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
  padding-top: 1.25rem;
}

.inv-card {
  border-radius: 14px;
  padding: 1.25rem;
  border: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.06);
  }

  &.style-low {
    background: #fffafa;
    border-color: #fee2e2;
  }

  &.style-warning {
    background: #fffcf0;
    border-color: #fef3c7;
  }

  &.style-optimal {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  &.style-overstock {
    background: #eff6ff;
    border-color: #bfdbfe;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-width: 0;
}

.card-cat {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 1px;
}

.card-name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-provider {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.3rem;

  i {
    font-size: 0.7rem;
  }
}

.status-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;

  &.dot-low {
    background: #ef4444;
  }

  &.dot-warning {
    background: #f59e0b;
  }

  &.dot-optimal {
    background: #10b981;
  }

  &.dot-overstock {
    background: #3b82f6;
  }
}

// Progress bar (critical)
.progress-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;

  .progress-qty {
    color: #1e293b;
    font-size: 0.95rem;
    font-weight: 700;
  }
}

.progress-track {
  height: 8px;
  background: #e2e8f0;
  border-radius: 99px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 99px;

  &.fill-low {
    background: #ef4444;
  }
}

.progress-hint {
  font-size: 0.72rem;
  font-weight: 700;
  color: #94a3b8;
  text-align: right;
}

// Stock comparison (warning / optimal / overstock)
.stock-comparison {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  border-radius: 10px;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.cmp-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;

  .cmp-label {
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    color: #94a3b8;
    letter-spacing: 0.5px;
  }

  .cmp-value {
    font-size: 1rem;
    font-weight: 800;
    color: #1e293b;

    &.cmp-green {
      color: #047857;
    }

    &.cmp-blue {
      color: #1d4ed8;
    }
  }
}

.cmp-arrow {
  color: #cbd5e1;
  font-size: 0.85rem;
  flex-shrink: 0;

  &.cmp-arrow-green {
    color: #10b981;
  }

  &.cmp-arrow-blue {
    color: #3b82f6;
  }
}

// Card footer / order button
.card-footer {
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: 0.85rem;
  margin-top: auto;
}

.btn-order {
  width: 100%;
  padding: 0.65rem;
  border-radius: 10px;
  border: 1px solid rgba($NICOLE-PURPLE, 0.25);
  background: white;
  color: $NICOLE-PURPLE;
  font-weight: 800;
  font-size: 0.82rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover {
    background: $NICOLE-PURPLE;
    color: white;
    border-color: $NICOLE-PURPLE;
  }
}

// Empty section message
.empty-msg {
  text-align: center;
  padding: 2.5rem;
  color: #94a3b8;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;

  i {
    font-size: 2.5rem;
    opacity: 0.3;
  }
}

// Shine animation for critical dot
.shine {
  animation: shine-pulse 2s infinite;
}

@keyframes shine-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
  }

  70% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}
</style>
