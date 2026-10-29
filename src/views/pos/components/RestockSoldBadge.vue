<script setup lang="ts">
withDefaults(defineProps<{
  vendido: number | null;
  loading: boolean;
  muted: boolean; // suministros: no se venden en caja
  label?: string;
  icon?: string;
}>(), { label: 'Vendido Hoy', icon: 'fa-cash-register' });
</script>

<template>
  <div class="sold-box" :class="{ muted }">
    <span class="sold-label" title="Dato de Contífico"><i class="fa-solid" :class="icon"></i> {{ label }}</span>
    <span v-if="muted" class="sold-value na" title="Los suministros no se venden en caja">—</span>
    <span v-else-if="loading" class="sold-value loading"><i class="fa-solid fa-spinner fa-spin"></i></span>
    <span v-else-if="vendido !== null" class="sold-value">{{ vendido }}</span>
    <span v-else class="sold-value na" title="Sin conexión con Contífico">—</span>
  </div>
</template>

<style lang="scss" scoped>
.sold-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  border: 1.5px solid #bfdbfe;
  border-radius: 10px;
  padding: 0.4rem 0.9rem;
  min-width: 92px;
  align-self: stretch;

  .sold-label {
    font-size: 0.62rem;
    font-weight: 800;
    color: #1d4ed8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-bottom: 2px;
    white-space: nowrap;
  }

  .sold-value {
    font-size: 1.45rem;
    font-weight: 800;
    color: #1e40af;
    line-height: 1.2;

    &.na { color: #93c5fd; font-weight: 600; }
    &.loading { font-size: 1rem; color: #60a5fa; }
  }

  &.muted {
    background: #f8fafc;
    border-color: #e2e8f0;

    .sold-label { color: #94a3b8; }
    .sold-value.na { color: #cbd5e1; }
  }
}

@media (max-width: 560px) {
  .sold-box {
    flex-direction: row;
    justify-content: space-between;
    padding: 0.6rem 1rem;

    .sold-label { margin-bottom: 0; }
  }
}
</style>
