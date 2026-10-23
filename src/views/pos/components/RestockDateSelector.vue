<script setup lang="ts">
// ───────────────────────────────────────────────────────────────────────
// TEMPORAL (pruebas): permite hacer el cierre para otro día (ej. mañana).
// Para quitarlo: borrar este archivo y su uso en RestockDailyModal.vue /
// RestockDailyForm.vue, y dejar de pasar la fecha a useDailyClosing().
// ───────────────────────────────────────────────────────────────────────
import { computed } from 'vue';
import { getECTTodayString } from '@/utils/dateUtils';
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const shift = (base: string, days: number) => {
  const [y, m, d] = base.split('-').map(Number);
  const t = new Date(y!, m! - 1, d! + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const today = computed(() => getECTTodayString());
const tomorrow = computed(() => shift(today.value, 1));

const current = computed(() => props.modelValue || today.value);
const isToday = computed(() => current.value === today.value);
const isTomorrow = computed(() => current.value === tomorrow.value);

const niceDate = computed(() => {
  const [y, m, d] = current.value.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('es-EC', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
});

const set = (value: string) => emit('update:modelValue', value);
</script>

<template>
  <div class="date-selector">
    <div class="row">
      <span class="label"><i class="fa-regular fa-calendar"></i> Cierre del día</span>
      <div class="pills">
        <button type="button" :class="{ active: isToday }" @click="set(today)">Hoy</button>
        <button type="button" :class="{ active: isTomorrow }" @click="set(tomorrow)">Mañana</button>
      </div>
      <div class="picker">
        <CustomDatePicker
          :model-value="current"
          placeholder="Otra fecha"
          @update:model-value="set($event)"
        />
      </div>
    </div>

    <p class="current" :class="{ warn: !isToday }">
      <i :class="isToday ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'"></i>
      <span v-if="isToday">Estás cerrando <strong>hoy</strong> · {{ niceDate }}</span>
      <span v-else>
        Ojo: este cierre se guardará para <strong>{{ niceDate }}</strong>, no para hoy.
      </span>
    </p>
  </div>
</template>

<style lang="scss" scoped>
.date-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;

  i { color: #94a3b8; }
}

.pills {
  display: flex;
  gap: 0.3rem;

  button {
    padding: 0.4rem 0.9rem;
    border-radius: 8px;
    border: 1.5px solid #e2e8f0;
    background: white;
    color: #475569;
    font-size: 0.82rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;

    &:hover { border-color: #94a3b8; }

    &.active {
      background: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
      color: white;
    }
  }
}

.picker { flex: 1 1 160px; min-width: 150px; }

.current {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.8rem;
  color: #15803d;
  text-transform: capitalize;

  i { font-size: 0.8rem; }
  strong { font-weight: 800; }

  &.warn {
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 0.45rem 0.7rem;
    text-transform: none;
  }
}
</style>
