<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ elapsed: number }>();

// Mensajes honestos por etapa: la primera carga del día cruza con Contífico
// y tarda; después queda en caché y las secciones cambian al instante.
const message = computed(() => {
  if (props.elapsed < 4) return 'Conectando con Contífico...';
  if (props.elapsed < 12) return 'Descargando las facturas del día...';
  if (props.elapsed < 22) return 'Cruzando las ventas con los cierres y las bajas...';
  return 'Casi listo: Contífico está lento hoy, pero esto se guarda y la próxima vez abre al instante.';
});

const progress = computed(() => Math.min(95, Math.round((props.elapsed / 28) * 100)));
</script>

<template>
  <div class="ops-loading">
    <div class="pulse-icon"><i class="fa-solid fa-arrows-rotate fa-spin"></i></div>
    <h3>{{ message }}</h3>
    <div class="bar"><div class="fill" :style="{ width: progress + '%' }"></div></div>
    <p class="elapsed">{{ elapsed }}s · la primera carga del día tarda ~20-30s, luego es instantánea</p>

    <div class="skeletons">
      <div class="sk sk-kpis"></div>
      <div class="sk sk-card"></div>
      <div class="sk sk-card short"></div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ops-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1rem 1rem;
  text-align: center;
}

.pulse-icon {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ede9fe, #f3e8ff);
  color: #7c3aed;
  font-size: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

h3 { margin: 0 0 0.9rem; color: #1e293b; font-size: 1.05rem; }

.bar {
  width: 100%;
  max-width: 420px;
  height: 8px;
  background: #e2e8f0;
  border-radius: 10px;
  overflow: hidden;

  .fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed, #a855f7);
    border-radius: 10px;
    transition: width 1s linear;
  }
}

.elapsed { margin: 0.6rem 0 0; font-size: 0.78rem; color: #94a3b8; }

.skeletons {
  width: 100%;
  max-width: 900px;
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .sk {
    border-radius: 14px;
    background: linear-gradient(90deg, #f1f5f9 25%, #e9eef5 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }

  .sk-kpis { height: 92px; }
  .sk-card { height: 170px; }
  .sk-card.short { height: 110px; }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
