<script setup lang="ts">
import { computed } from 'vue';
import { getECTTodayString } from '@/utils/dateUtils';
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue';

const props = defineProps<{
  title: string;
  subtitle: string;
  icon: string;
  date: string;
  dateTo: string;
  isLoading: boolean;
}>();

const emit = defineEmits(['set-date', 'refresh', 'open-range']);

const isRange = computed(() => props.dateTo !== props.date);

const shiftDate = (base: string, days: number) => {
  const [y, m, d] = base.split('-').map(Number);
  const t = new Date(y!, m! - 1, d! + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const today = () => getECTTodayString();
const yesterday = computed(() => shiftDate(today(), -1));

const fmt = (s: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('es-EC', opts);
};

const niceDate = computed(() => {
  if (isRange.value) {
    return `Del ${fmt(props.date, { day: 'numeric', month: 'long' })} al ${fmt(props.dateTo, { day: 'numeric', month: 'long' })} (acumulado)`;
  }
  return fmt(props.date, { weekday: 'long', day: 'numeric', month: 'long' });
});
</script>

<template>
  <header class="ops-header">
    <div class="title-side">
      <h1><i class="fa-solid" :class="icon"></i> {{ title }}</h1>
      <p>{{ subtitle }}</p>
      <span class="nice-date"><i class="fa-regular fa-calendar"></i> {{ niceDate }}</span>
    </div>
    <div class="date-controls">
      <button :class="{ active: !isRange && date === today() }" :disabled="isLoading" @click="emit('set-date', today())">Hoy</button>
      <button :class="{ active: !isRange && date === yesterday }" :disabled="isLoading" @click="emit('set-date', yesterday)">Ayer</button>
      <button class="range-btn" :class="{ active: isRange }" :disabled="isLoading" title="Elegir desde–hasta" @click="emit('open-range')">
        <i class="fa-solid fa-calendar-week"></i> Periodo
      </button>
      <div class="picker-wrap">
        <CustomDatePicker
          :model-value="isRange ? '' : date"
          :max-date="today()"
          :disabled="isLoading"
          placeholder="Otra fecha"
          @update:model-value="emit('set-date', $event)"
        />
      </div>
      <button class="refresh" :disabled="isLoading" title="Volver a cruzar con Contífico" @click="emit('refresh')">
        <i class="fa-solid fa-rotate" :class="{ 'fa-spin': isLoading }"></i>
      </button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.ops-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.title-side {
  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.45rem;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    i { color: #7c3aed; }
  }

  p { margin: 0 0 0.35rem; color: #64748b; font-size: 0.88rem; max-width: 560px; }

  .nice-date {
    color: #7c3aed;
    font-weight: 800;
    font-size: 0.85rem;
    text-transform: capitalize;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
}

.date-controls {
  display: flex;
  gap: 0.4rem;
  align-items: center;

  button {
    padding: 0.55rem 1.1rem;
    border-radius: 10px;
    border: 1.5px solid #e2e8f0;
    background: white;
    color: #475569;
    font-weight: 800;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s;

    &:hover:not(:disabled) { border-color: #94a3b8; }
    &.active { background: #0f172a; border-color: #0f172a; color: white; }
    &:disabled { opacity: 0.55; cursor: not-allowed; }

    &.refresh { padding: 0.55rem 0.8rem; color: #7c3aed; }

    &.range-btn {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      i { font-size: 0.8rem; }
      &.active { background: #7c3aed; border-color: #7c3aed; }
    }
  }

  .picker-wrap { min-width: 180px; }
}
</style>
