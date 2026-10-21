<script setup lang="ts">
defineProps<{
  vendido: number;
  ventaCierre: number;
  bajas: number;
  descuadre: number;
}>();
</script>

<template>
  <div class="kpi-row">
    <div class="kpi vendido">
      <span class="kpi-label"><i class="fa-solid fa-cash-register"></i> Vendido (Contífico)</span>
      <span class="kpi-value">{{ vendido }}</span>
      <span class="kpi-hint">unidades facturadas</span>
    </div>
    <div class="kpi cierre">
      <span class="kpi-label"><i class="fa-solid fa-clipboard-check"></i> Venta según cierre</span>
      <span class="kpi-value">{{ ventaCierre }}</span>
      <span class="kpi-hint">lo que salió de vitrina</span>
    </div>
    <div class="kpi bajas">
      <span class="kpi-label"><i class="fa-solid fa-triangle-exclamation"></i> Bajas</span>
      <span class="kpi-value">{{ bajas }}</span>
      <span class="kpi-hint">desecho reportado</span>
    </div>
    <div class="kpi descuadre" :class="{ ok: descuadre === 0, bad: descuadre !== 0 }">
      <span class="kpi-label"><i class="fa-solid fa-scale-unbalanced"></i> Descuadre</span>
      <span class="kpi-value">{{ descuadre > 0 ? `+${descuadre}` : descuadre }}</span>
      <span class="kpi-hint">{{ descuadre === 0 ? 'todo cuadra ✓' : 'cierre vs Contífico' }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.kpi {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  .kpi-label {
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .kpi-value { font-size: 1.9rem; font-weight: 800; color: #0f172a; line-height: 1.2; }
  .kpi-hint { font-size: 0.74rem; color: #94a3b8; }

  &.vendido { border-top: 4px solid #2563eb; .kpi-label i { color: #2563eb; } }
  &.cierre { border-top: 4px solid #7c3aed; .kpi-label i { color: #7c3aed; } }
  &.bajas { border-top: 4px solid #f59e0b; .kpi-label i { color: #f59e0b; } }

  &.descuadre.ok {
    border-top: 4px solid #16a34a;
    .kpi-value { color: #16a34a; }
    .kpi-label i { color: #16a34a; }
  }

  &.descuadre.bad {
    border-top: 4px solid #dc2626;
    background: #fff7f7;
    .kpi-value { color: #dc2626; }
    .kpi-label i { color: #dc2626; }
  }
}
</style>
