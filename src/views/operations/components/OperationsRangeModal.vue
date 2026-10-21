<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { getECTTodayString } from '@/utils/dateUtils';
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue';

const props = defineProps<{
  isOpen: boolean;
  initialFrom: string;
  initialTo: string;
}>();

const emit = defineEmits(['apply', 'close']);

const from = ref(props.initialFrom);
const to = ref(props.initialTo);

const shift = (base: string, days: number) => {
  const [y, m, d] = base.split('-').map(Number);
  const t = new Date(y!, m! - 1, d! + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const today = () => getECTTodayString();

const presets = computed(() => {
  const hoy = today();
  const [y, m, d] = hoy.split('-').map(Number);
  const dow = new Date(y!, m! - 1, d!).getDay() || 7; // lunes = 1
  const lunesEsta = shift(hoy, -(dow - 1));
  return [
    { label: 'Últimos 7 días', from: shift(hoy, -6), to: hoy },
    { label: 'Esta semana', from: lunesEsta, to: hoy },
    { label: 'Semana pasada', from: shift(lunesEsta, -7), to: shift(lunesEsta, -1) },
    { label: 'Este mes', from: `${hoy.slice(0, 8)}01`, to: hoy },
    { label: 'Últimos 15 días', from: shift(hoy, -14), to: hoy },
    { label: 'Últimos 30 días', from: shift(hoy, -29), to: hoy },
  ];
});

watch(() => props.isOpen, (open) => {
  if (open) {
    from.value = props.initialFrom;
    to.value = props.initialTo;
  }
});

const daysCount = computed(() => {
  const a = new Date(from.value + 'T00:00:00');
  const b = new Date(to.value + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
});

const isValid = computed(() => from.value && to.value && to.value >= from.value && daysCount.value <= 31);

const isActivePreset = (p: { from: string; to: string }) => p.from === from.value && p.to === to.value;

const apply = () => {
  if (!isValid.value) return;
  emit('apply', { from: from.value, to: to.value });
};
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="range-backdrop" @click.self="emit('close')">
      <div class="range-card">
        <h3><i class="fa-solid fa-calendar-week"></i> Elegir periodo</h3>
        <p>Escoge un atajo o arma tu rango desde–hasta. La cuenta se acumula en el periodo.</p>

        <div class="presets">
          <button
            v-for="p in presets" :key="p.label"
            type="button" :class="{ active: isActivePreset(p) }"
            @click="from = p.from; to = p.to"
          >{{ p.label }}</button>
        </div>

        <div class="pickers">
          <div class="picker">
            <label><i class="fa-solid fa-play"></i> Desde</label>
            <CustomDatePicker v-model="from" :max-date="to || today()" placeholder="Desde" />
          </div>
          <i class="fa-solid fa-arrow-right arrow"></i>
          <div class="picker">
            <label><i class="fa-solid fa-flag-checkered"></i> Hasta</label>
            <CustomDatePicker v-model="to" :min-date="from" :max-date="today()" placeholder="Hasta" />
          </div>
        </div>

        <p class="days-note" :class="{ bad: daysCount > 31 }">
          <template v-if="daysCount > 31">Máximo 31 días — acorta el rango.</template>
          <template v-else-if="daysCount === 1">1 día seleccionado</template>
          <template v-else>{{ daysCount }} días seleccionados</template>
        </p>

        <div class="actions">
          <button class="btn-cancel" @click="emit('close')">Cancelar</button>
          <button class="btn-apply" :disabled="!isValid" @click="apply">
            <i class="fa-solid fa-check"></i> Ver periodo
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.range-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 25000;
  padding: 1rem;
}

.range-card {
  background: white;
  border-radius: 18px;
  padding: 1.75rem;
  width: 100%;
  max-width: 460px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);

  h3 {
    margin: 0 0 0.3rem;
    font-size: 1.2rem;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    i { color: #7c3aed; }
  }

  > p { margin: 0 0 1rem; font-size: 0.85rem; color: #64748b; }
}

.presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.45rem;
  margin-bottom: 1.1rem;

  button {
    padding: 0.55rem 0.4rem;
    border-radius: 10px;
    border: 1.5px solid #e2e8f0;
    background: white;
    color: #475569;
    font-weight: 700;
    font-size: 0.76rem;
    cursor: pointer;
    transition: all 0.15s;

    &:hover { border-color: #94a3b8; }
    &.active { background: #7c3aed; border-color: #7c3aed; color: white; }
  }
}

.pickers {
  display: flex;
  align-items: end;
  gap: 0.6rem;

  .picker {
    flex: 1;
    label {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.72rem;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      margin-bottom: 0.35rem;
      i { color: #7c3aed; font-size: 0.65rem; }
    }
  }

  .arrow { color: #cbd5e1; padding-bottom: 1.1rem; }
}

.days-note {
  margin: 0.7rem 0 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: #7c3aed;
  &.bad { color: #dc2626; }
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;

  button {
    padding: 0.7rem 1.3rem;
    border-radius: 10px;
    font-weight: 800;
    cursor: pointer;
    border: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-cancel {
    background: #f1f5f9;
    color: #64748b;
    &:hover { background: #e2e8f0; }
  }

  .btn-apply {
    background: #7c3aed;
    color: white;
    &:hover:not(:disabled) { background: #6d28d9; }
    &:disabled { background: #cbd5e1; cursor: not-allowed; }
  }
}
</style>
