<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  vendido: number; // lo que entra en el cuadre (filas completas)
  facturado: number; // todo lo facturado en Contífico, haya cierre o no
  bajas: number;
  excedentes: number;
  faltantes: number;
  anyClosing: boolean;
}>();

const hayFaltantes = computed(() => props.anyClosing && props.faltantes > 0);
const vendidoHint = computed(() => {
  if (props.facturado === props.vendido) return 'unidades facturadas';
  if (!props.anyClosing) return 'unidades facturadas · sin cierre aún';
  return `${props.vendido} con la cuenta completa`;
});
</script>

<template>
  <div class="kpi-row">
    <article class="kpi vendido">
      <span class="ico"><i class="fa-solid fa-cash-register"></i></span>
      <div class="body">
        <span class="label">Vendido en Contífico</span>
        <span class="value">{{ facturado }}</span>
        <span class="hint">{{ vendidoHint }}</span>
      </div>
    </article>

    <article class="kpi bajas">
      <span class="ico"><i class="fa-solid fa-triangle-exclamation"></i></span>
      <div class="body">
        <span class="label">Bajas</span>
        <span class="value">{{ anyClosing ? bajas : '—' }}</span>
        <span class="hint">{{ anyClosing ? 'desecho reportado' : 'llegan con el cierre' }}</span>
      </div>
    </article>

    <article class="kpi descuadre" :class="anyClosing ? 'is-ok' : 'is-pending'">
      <span class="ico"><i class="fa-solid fa-circle-plus"></i></span>
      <div class="body">
        <span class="label">Excedentes</span>
        <span class="value">{{ !anyClosing ? '—' : excedentes > 0 ? `+${excedentes}` : 0 }}</span>
        <span class="hint">{{ anyClosing ? 'unidades que sobran' : 'esperando cierres' }}</span>
      </div>
    </article>

    <article class="kpi descuadre" :class="!anyClosing ? 'is-pending' : hayFaltantes ? 'is-bad' : 'is-ok'">
      <span class="ico"><i class="fa-solid fa-circle-minus"></i></span>
      <div class="body">
        <span class="label">Faltantes</span>
        <span class="value">{{ !anyClosing ? '—' : faltantes > 0 ? `−${faltantes}` : 0 }}</span>
        <span class="hint">{{ anyClosing ? 'unidades que faltan' : 'esperando cierres' }}</span>
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

  // Sin cierres todavía: ni verde ni rojo, es "aún no se sabe"
  &.is-pending {
    &::before { background: #cbd5e1; }
    .ico { background: #f1f5f9; color: #94a3b8; }
    .value { color: #94a3b8; }
  }
}
</style>
