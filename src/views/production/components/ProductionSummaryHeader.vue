<script setup lang="ts">
defineProps<{
  isBackgroundLoading: boolean;
  showHistory: boolean;
  isLoading: boolean;
  sourceFilter: 'all' | 'nicole' | 'sucree';
  bucketFilter: string;
  hasOrders: boolean;
  selectedCount: number;
  isExporting: boolean;
  exportMode: 'dispatch' | 'production';
  sourceCounts: { all: number; nicole: number; sucree: number };
}>();

const emit = defineEmits(['toggle-history', 'refresh', 'set-source', 'set-bucket', 'export']);

const buckets = [
  { key: 'delayed', label: 'Atrasados', icon: 'fa-clock' },
  { key: 'today', label: 'Hoy', icon: 'fa-calendar-day' },
  { key: 'tomorrow', label: 'Mañana', icon: 'fa-sun' },
  { key: 'future', label: 'Futuro', icon: 'fa-calendar-alt' },
  { key: 'all', label: 'Todos', icon: 'fa-layer-group' },
];

const sources = [
  { key: 'all', label: 'Todas', icon: 'fa-layer-group' },
  { key: 'nicole', label: 'Nicole', icon: 'fa-birthday-cake' },
  { key: 'sucree', label: 'Sucree', icon: 'fa-star' },
];
</script>

<template>
  <div class="header-section">
    <div class="header-top">
      <div class="header-content">
        <h1>
          Resumen de Producción
          <span v-if="isBackgroundLoading" class="refreshing-badge">
            <i class="fas fa-sync-alt fa-spin"></i> Actualizando...
          </span>
        </h1>
        <p>Control de pedidos y producción por destino</p>
      </div>
      <div class="header-actions">
        <button class="btn-history" :class="{ active: showHistory }" @click="emit('toggle-history')">
          <i class="fas" :class="showHistory ? 'fa-arrow-left' : 'fa-history'"></i>
          {{ showHistory ? 'Volver' : 'Completados' }}
        </button>
        <button v-if="!showHistory" class="btn-refresh" :disabled="isLoading" @click="emit('refresh')">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
          Actualizar
        </button>
      </div>
    </div>

    <div class="source-filter-bar" v-if="!showHistory">
      <button
        v-for="src in sources"
        :key="src.key"
        class="source-pill"
        :class="[`source-pill--${src.key}`, { active: sourceFilter === src.key }]"
        @click="emit('set-source', src.key)"
      >
        <i :class="`fas ${src.icon}`"></i>
        {{ src.label }}
        <span class="pill-count">{{ sourceCounts[src.key as 'all' | 'nicole' | 'sucree'] }}</span>
      </button>
    </div>

    <div class="raw-filter-pills" v-if="!showHistory">
      <button
        v-for="bucket in buckets"
        :key="bucket.key"
        class="raw-pill"
        :class="{ active: bucketFilter === bucket.key, [bucket.key]: true }"
        @click="emit('set-bucket', bucket.key)"
      >
        <i class="fas" :class="bucket.icon"></i>
        {{ bucket.label }}
      </button>
    </div>

    <div class="raw-export-actions" v-if="!showHistory && hasOrders">
      <span class="export-label"><i class="fas fa-file-excel"></i> Exportar:</span>
      <button
        class="btn-export-prod delivery"
        :disabled="isExporting"
        title="Excel para despachar los pedidos a cada destino (elige sucursal y fecha)"
        @click="emit('export', 'dispatch')"
      >
        <i class="fas" :class="isExporting && exportMode === 'dispatch' ? 'fa-spinner fa-spin' : 'fa-truck-loading'"></i>
        {{ selectedCount > 0 ? `Orden de Entrega (${selectedCount} prod.)` : 'Orden de Entrega' }}
      </button>
      <button
        class="btn-export-prod production"
        :disabled="isExporting"
        title="Excel para la cocina con las categorías de Contífico (elige sucursal y fecha)"
        @click="emit('export', 'production')"
      >
        <i class="fas" :class="isExporting && exportMode === 'production' ? 'fa-spinner fa-spin' : 'fa-bread-slice'"></i>
        {{ selectedCount > 0 ? `Orden de Producción (${selectedCount} prod.)` : 'Orden de Producción' }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$color-urgent: #e74c3c;
$color-warning: #f1c40f;
$color-info: #3498db;
$color-delayed: #e67e22;

.header-section {
  background: white;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (min-width: 768px) { padding: 1.25rem 2rem; }
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;

  .header-content {
    h1 {
      font-size: 1.4rem;
      font-weight: 800;
      color: #2c3e50;
      margin: 0 0 0.2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;

      @media (min-width: 768px) { font-size: 1.8rem; }
    }

    p { margin: 0; font-size: 0.85rem; color: #64748b; }
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;

    button {
      background: white;
      border: 1px solid #e1e8ed;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      color: #2c3e50;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px); }
      i { font-size: 1rem; }
      &.btn-history.active { background: #2c3e50; color: white; border-color: #2c3e50; }

      &.btn-refresh {
        color: $color-info;
        border-color: rgba($color-info, 0.3);
        &:hover { background: rgba($color-info, 0.05); border-color: $color-info; }
      }
    }
  }
}

.refreshing-badge {
  font-size: 0.75rem; background: #e1f5fe; color: #0288d1;
  padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 700;
  display: flex; align-items: center; gap: 0.4rem; border: 1px solid #b3e5fc;
}

.source-filter-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.source-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border-radius: 20px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: #f1f5f9; }
  &--all.active { background: #1e293b; border-color: #1e293b; color: white; }

  &--nicole {
    i { color: #7c3aed; }
    &.active { background: #7c3aed; border-color: #7c3aed; color: white; i { color: white; } }
  }

  &--sucree {
    i { color: #d97706; }
    &.active { background: #d97706; border-color: #d97706; color: white; i { color: white; } }
  }
}

.raw-filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar { display: none; }
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.raw-pill {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid #f1f2f6;
  color: #64748b;
  padding: 0.6rem 1.25rem;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover { background: #f8fafc; border-color: #cbd5e1; }

  &.active {
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);

    &.delayed { background: $color-delayed; border-color: $color-delayed; }
    &.today { background: $color-urgent; border-color: $color-urgent; }
    &.tomorrow { background: $color-warning; border-color: $color-warning; }
    &.future { background: $color-info; border-color: $color-info; }
    &.all { background: #64748b; border-color: #64748b; }
  }
}

.raw-export-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }

.export-label {
  font-size: 0.78rem; font-weight: 800; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.4px;
  display: flex; align-items: center; gap: 0.4rem;
  i { color: #16a34a; }
}

.pill-count { background: rgba(0, 0, 0, 0.08); font-size: 0.7rem; font-weight: 800; padding: 1px 7px; border-radius: 10px; }
.source-pill.active .pill-count { background: rgba(255, 255, 255, 0.25); }

.btn-export-prod {
  background: #8e44ad;
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(142, 68, 173, 0.25);

  &.delivery { background: #3498db; box-shadow: 0 4px 12px rgba(52, 152, 219, 0.25); &:hover:not(:disabled) { background: darken(#3498db, 5%); } }
  &.production { background: #e67e22; box-shadow: 0 4px 12px rgba(230, 126, 34, 0.25); &:hover:not(:disabled) { background: darken(#e67e22, 5%); } }

  &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15); }
  &:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; color: #94a3b8; }
}
</style>
