<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  vendido: number;
  ventaCierre: number;
  bajas: number;
  descuadre: number;
}>();

// Negativo = falta (rojo) · Positivo o cero = verde
const descuadreNeg = computed(() => props.descuadre < 0);
</script>

<template>
  <div class="kpi-row">
    <article class="kpi vendido">
      <span class="ico"><i class="fa-solid fa-cash-register"></i></span>
      <div class="body">
        <span class="label">Vendido en Contífico</span>
        <span class="value">{{ vendido }}</span>
        <span class="hint">unidades facturadas</span>
      </div>
    </article>

    <article class="kpi cierre">
      <span class="ico"><i class="fa-solid fa-clipboard-check"></i></span>
      <div class="body">
        <span class="label">Venta según cierre</span>
        <span class="value">{{ ventaCierre }}</span>
        <span class="hint">lo que salió de vitrina</span>
      </div>
    </article>

    <article class="kpi bajas">
      <span class="ico"><i class="fa-solid fa-triangle-exclamation"></i></span>
      <div class="body">
        <span class="label">Bajas</span>
        <span class="value">{{ bajas }}</span>
        <span class="hint">desecho reportado</span>
      </div>
    </article>

    <article class="kpi descuadre" :class="descuadreNeg ? 'is-bad' : 'is-ok'">
      <span class="ico">
        <i :class="descuadreNeg ? 'fa-solid fa-scale-unbalanced' : 'fa-solid fa-circle-check'"></i>
      </span>
      <div class="body">
        <span class="label">Diferencia</span>
        <span class="value">{{ descuadre > 0 ? `+${descuadre}` : descuadre }}</span>
        <span class="hint">
          {{ descuadre === 0 ? 'todo cuadra' : descuadreNeg ? `faltan ${Math.abs(descuadre)} unids` : `sobran ${descuadre} unids` }}
        </span>
      </div>
    </article>
  </div>
</template>

<style lang="scss" scoped>
.kpi-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
}

.kpi {
  flex: 1 1 210px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  background: white;
  border: 1px solid #e9eef5;
  border-radius: 16px;
  padding: 1.1rem 1.15rem;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  transition: transform 0.18s, box-shadow 0.18s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  }

  // Barra de acento superior
  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
  }
}

.ico {
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}

.body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.label {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a97a8;
}

.value {
  font-size: 1.85rem;
  font-weight: 800;
  line-height: 1.15;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.hint {
  font-size: 0.74rem;
  color: #9aa6b6;
}

.vendido {
  &::before { background: #2563eb; }
  .ico { background: #eff6ff; color: #2563eb; }
}

.cierre {
  &::before { background: #7c3aed; }
  .ico { background: #f5f3ff; color: #7c3aed; }
}

.bajas {
  &::before { background: #f59e0b; }
  .ico { background: #fffbeb; color: #d97706; }
}

.descuadre {
  &.is-ok {
    &::before { background: #16a34a; }
    .ico { background: #f0fdf4; color: #16a34a; }
    .value { color: #15803d; }
  }

  &.is-bad {
    border-color: #fbd5d5;
    background: linear-gradient(180deg, #fffafa, white 55%);
    &::before { background: #dc2626; }
    .ico { background: #fee2e2; color: #dc2626; }
    .value { color: #dc2626; }
    .hint { color: #b91c1c; font-weight: 600; }
  }
}
</style>
