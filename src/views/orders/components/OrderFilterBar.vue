<script setup lang="ts">
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'

export type FilterMode = 'today' | 'yesterday' | 'tomorrow' | 'all' | 'custom' | 'invoiceError' | 'unbilled' | 'returns' | 'webPending'
export type DateType = 'deliveryDate' | 'createdAt'

const props = defineProps<{
  filterMode: FilterMode
  dateType: DateType
  customDate: string
  searchQuery: string
  showDatePicker: boolean
  showSelectAll: boolean
  isSelectAllActive: boolean
  /** Pedidos de la tienda online por gestionar. */
  webPendingCount?: number
}>()

const emit = defineEmits<{
  (e: 'update:filterMode', value: FilterMode): void
  (e: 'update:dateType', value: DateType): void
  (e: 'update:customDate', value: string): void
  (e: 'update:searchQuery', value: string): void
  (e: 'search'): void
  (e: 'toggle-select-all'): void
  (e: 'export-production'): void
  (e: 'export-dispatch'): void
}>()
</script>

<template>
  <nav class="sidebar-nav">

    <!-- TOP group -->
    <div class="nav-top">

      <!-- Search -->
      <div class="nav-section">
        <div class="search-wrapper">
          <i class="fas fa-search"></i>
          <input
            type="text"
            :value="searchQuery"
            @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
            placeholder="Buscar por nombre, RUC..."
            @keyup.enter="emit('search')"
          />
        </div>
      </div>

      <!-- Tienda online -->
      <div class="nav-section">
        <span class="section-label">Tienda online</span>
        <button
          class="nav-pill pill-web"
          :class="{ active: filterMode === 'webPending', 'has-pending': (webPendingCount || 0) > 0 }"
          @click="emit('update:filterMode', 'webPending')"
        >
          <i class="fas fa-shopping-bag"></i>
          <span class="pill-text">Web por gestionar</span>
          <span v-if="(webPendingCount || 0) > 0" class="pill-count">{{ webPendingCount }}</span>
        </button>
      </div>

      <!-- Period -->
      <div class="nav-section">
        <span class="section-label">Período</span>
        <div class="nav-pills">
          <button class="nav-pill" :class="{ active: filterMode === 'yesterday' }" @click="emit('update:filterMode', 'yesterday')">
            <i class="fas fa-chevron-left"></i> Ayer
          </button>
          <button class="nav-pill" :class="{ active: filterMode === 'today' }" @click="emit('update:filterMode', 'today')">
            <i class="fas fa-calendar-day"></i> Hoy
          </button>
          <button class="nav-pill" :class="{ active: filterMode === 'tomorrow' }" @click="emit('update:filterMode', 'tomorrow')">
            <i class="fas fa-chevron-right"></i> Mañana
          </button>
          <button class="nav-pill" :class="{ active: filterMode === 'all' }" @click="emit('update:filterMode', 'all')">
            <i class="fas fa-list"></i> Todos
          </button>
          <button class="nav-pill" :class="{ active: filterMode === 'custom' }" @click="emit('update:filterMode', 'custom')">
            <i class="fas fa-calendar-alt"></i> Fecha específica
          </button>
        </div>
      </div>

      <!-- Special Status -->
      <div class="nav-section">
        <span class="section-label">Estado especial</span>
        <div class="nav-pills">
          <button class="nav-pill pill-error" :class="{ active: filterMode === 'invoiceError' }" @click="emit('update:filterMode', 'invoiceError')">
            <i class="fas fa-exclamation-triangle"></i> Errores de facturación
          </button>
          <button class="nav-pill pill-warning" :class="{ active: filterMode === 'unbilled' }" @click="emit('update:filterMode', 'unbilled')">
            <i class="fas fa-file-invoice"></i> No facturados
          </button>
          <button class="nav-pill pill-warning" :class="{ active: filterMode === 'returns' }" @click="emit('update:filterMode', 'returns')">
            <i class="fas fa-undo"></i> Devoluciones
          </button>
        </div>
      </div>

      <!-- Date Type -->
      <div class="nav-section">
        <span class="section-label">Filtrar fechas por</span>
        <div class="date-type-toggle">
          <button class="toggle-btn" :class="{ active: dateType === 'deliveryDate' }" @click="emit('update:dateType', 'deliveryDate')">
            Entrega
          </button>
          <button class="toggle-btn" :class="{ active: dateType === 'createdAt' }" @click="emit('update:dateType', 'createdAt')">
            Registro
          </button>
        </div>
      </div>

      <!-- Specific Date Picker -->
      <div v-if="showDatePicker" class="nav-section">
        <span class="section-label">{{ ['invoiceError', 'returns', 'unbilled'].includes(filterMode) ? 'Fecha (opcional)' : 'Seleccionar fecha' }}</span>
        <CustomDatePicker
          :model-value="customDate"
          @update:model-value="emit('update:customDate', $event)"
        />
      </div>

      <!-- Batch Select All -->
      <div v-if="showSelectAll" class="nav-section">
        <button class="btn-select-all" @click="emit('toggle-select-all')">
          <i class="fas" :class="isSelectAllActive ? 'fa-square-check' : 'fa-square'"></i>
          {{ isSelectAllActive ? 'Deseleccionar todo' : 'Seleccionar todo' }}
        </button>
      </div>

    </div>

    <!-- BOTTOM group: export -->
    <div class="nav-bottom">
      <span class="section-label">Exportar</span>
      <button class="btn-export production" @click="emit('export-production')">
        <i class="fas fa-clipboard-list"></i>
        <span>Orden de Producción</span>
      </button>
      <button class="btn-export dispatch" @click="emit('export-dispatch')">
        <i class="fas fa-truck-loading"></i>
        <span>Orden de Entrega</span>
      </button>
    </div>

  </nav>
</template>

<style lang="scss" scoped>
.sidebar-nav {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 0.9rem 0.85rem 1rem;
  overflow-y: auto;
  overflow-x: visible;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.nav-top {
  display: flex;
  flex-direction: column;
}

.nav-bottom {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-top: 0.9rem;
  border-top: 1px solid #f1f5f9;
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
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.12);
    }

    &::placeholder { color: #94a3b8; }
  }
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

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
    i { color: #64748b; }
  }

  &.active {
    background: #ede9fe;
    color: #7c3aed;
    font-weight: 700;
    i { color: #7c3aed; }
  }

  &.pill-error {
    &:hover { background: #fef2f2; color: #dc2626; i { color: #dc2626; } }
    &.active { background: #fef2f2; color: #dc2626; font-weight: 700; i { color: #dc2626; } }
  }

  &.pill-web {
    .pill-text { flex: 1; }

    .pill-count {
      min-width: 20px;
      padding: 1px 7px;
      border-radius: 10px;
      background: #490F57;
      color: white;
      font-size: 0.72rem;
      font-weight: 800;
      text-align: center;
    }

    &.has-pending {
      background: #f5eef7;
      color: #490F57;
      font-weight: 700;
      i { color: #490F57; }
    }

    &:hover { background: #efe3f2; color: #490F57; i { color: #490F57; } }
    &.active { background: #490F57; color: white; font-weight: 700; i { color: white; } .pill-count { background: white; color: #490F57; } }
  }

  &.pill-warning {
    &:hover { background: #fffbeb; color: #d97706; i { color: #d97706; } }
    &.active { background: #fffbeb; color: #d97706; font-weight: 700; i { color: #d97706; } }
  }
}

.date-type-toggle {
  display: flex;
  background: #f1f5f9;
  border-radius: 9px;
  padding: 0.18rem;
  gap: 0.12rem;

  .toggle-btn {
    flex: 1;
    border: none;
    background: transparent;
    padding: 0.38rem;
    border-radius: 7px;
    font-size: 0.82rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;

    &.active {
      background: white;
      color: #7c3aed;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    &:hover:not(.active) { color: #1e293b; }
  }
}

.btn-select-all {
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

.btn-export {
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
    background: #f0f9ff;
    color: #0284c7;
    border-color: #e0f2fe;
    &:hover { background: #e0f2fe; border-color: #bae6fd; }
  }

  &.dispatch {
    background: #f0fdf4;
    color: #16a34a;
    border-color: #dcfce7;
    &:hover { background: #dcfce7; border-color: #bbf7d0; }
  }
}
</style>
