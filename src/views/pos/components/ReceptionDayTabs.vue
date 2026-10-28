<script setup lang="ts">
import { ref, computed } from 'vue';
import { getECTTodayString } from '@/utils/dateUtils';

export type ReceptionDayMode = 'yesterday' | 'today' | 'tomorrow' | 'date';

const mode = defineModel<ReceptionDayMode>('mode', { required: true });
const date = defineModel<string>('date', { required: true });

const dateInput = ref<HTMLInputElement | null>(null);

const formatLong = (value: string) =>
  new Date(value + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'long' });

const shiftToday = (offset: number) => {
  const d = new Date(getECTTodayString() + 'T12:00:00');
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const tabs = computed(() => [
  { key: 'yesterday' as const, day: 'Ayer', label: formatLong(shiftToday(-1)) },
  { key: 'today' as const, day: 'Hoy', label: formatLong(shiftToday(0)) },
  { key: 'tomorrow' as const, day: 'Mañana', label: formatLong(shiftToday(1)) },
]);

const openPicker = () => {
  const input = dateInput.value;
  if (!input) return;
  try {
    input.showPicker();
  } catch {
    input.focus();
  }
};

const onDateChange = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  if (!value) return;
  date.value = value;
  mode.value = 'date';
};
</script>

<template>
  <div class="day-tabs-wrap">
    <div class="filter-tabs">
      <button v-for="t in tabs" :key="t.key" :class="{ active: mode === t.key }" @click="mode = t.key">
        <span class="tab-day">{{ t.day }}</span>
        <span class="tab-date">{{ t.label }}</span>
      </button>
      <button class="date-tab" :class="{ active: mode === 'date' }" @click="openPicker">
        <span class="tab-day"><i class="fa-solid fa-calendar-days"></i> {{ mode === 'date' ? 'Fecha' : 'Otra fecha' }}</span>
        <span class="tab-date">{{ mode === 'date' ? formatLong(date) : 'Elegir día' }}</span>
        <input ref="dateInput" type="date" class="date-input" :value="date" tabindex="-1" @change="onDateChange" />
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.day-tabs-wrap {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  background: #F1F5F9;
  padding: 5px;
  border-radius: 10px;
  gap: 0.3rem;

  button {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    border: none;
    background: transparent;
    padding: 0.48rem 0.75rem;
    border-radius: 7px;
    font-weight: 700;
    color: $text-light;
    cursor: pointer;
    font-size: 0.82rem;
    transition: all 0.18s;
    white-space: nowrap;

    &:hover { background: rgba(0, 0, 0, 0.03); }
    &.active {
      background: white;
      color: $NICOLE-PURPLE;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
  }

  .date-tab { position: relative; }

  // Invisible pero presente: el selector nativo se abre con showPicker()
  .date-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
  }

  .tab-day {
    font-size: 0.82rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .tab-date {
    font-size: 0.68rem;
    font-weight: 500;
    opacity: 0.7;
    line-height: 1.1;
  }
}
</style>
