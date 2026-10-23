<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { getECTTodayString } from '@/utils/dateUtils';
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue';
import SearchableSelect from '@/components/ui/SearchableSelect.vue';

const props = defineProps<{
  isOpen: boolean;
  isLoading: boolean;
  mode: 'dispatch' | 'production';
  destinations: string[]; // sucursales/destinos disponibles
  selectedCount: number; // productos seleccionados (0 = todos)
  previewCount?: number | null;
}>();

const emit = defineEmits(['close', 'confirm', 'preview']);

const tomorrowStr = () => {
  const [y, m, d] = getECTTodayString().split('-').map(Number);
  const t = new Date(y!, m! - 1, d! + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const responsibleName = ref('');
const destination = ref('all');
const allDates = ref(false);
const date = ref(getECTTodayString());

watch(() => props.isOpen, (open) => {
  if (open) {
    destination.value = 'all';
    allDates.value = false;
    date.value = getECTTodayString();
  }
});

const title = computed(() =>
  props.mode === 'production' ? 'Exportar Orden de Producción' : 'Exportar Orden de Entrega'
);

// Avisa al padre qué se exportaría con la selección actual, para mostrar
// el conteo antes de presionar (así nunca se presiona a ciegas).
const emitPreview = () => {
  emit('preview', {
    destination: destination.value,
    date: allDates.value ? 'all' : date.value,
  });
};

watch([destination, date, allDates], emitPreview);
watch(() => props.isOpen, (open) => { if (open) emitPreview(); });

const destinationOptions = computed(() => [
  { value: 'all', label: 'Todas las sucursales' },
  ...props.destinations.map(d => ({ value: d, label: d })),
]);

const subtitle = computed(() =>
  props.mode === 'production'
    ? 'Excel para la cocina, agrupado por las categorías de Contífico.'
    : 'Excel para despachar los pedidos a cada destino.'
);

const quickDate = (value: string) => {
  allDates.value = false;
  date.value = value;
};

const confirm = () => {
  emit('confirm', {
    // El nombre es opcional: sin él el Excel sale a nombre de "Producción".
    responsibleName: responsibleName.value.trim() || 'Producción',
    destination: destination.value,
    date: allDates.value ? 'all' : date.value,
  });
};
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="export-overlay" @click.self="emit('close')">
      <div class="export-card">
        <h2><i class="fas" :class="mode === 'production' ? 'fa-bread-slice' : 'fa-truck-loading'"></i> {{ title }}</h2>
        <p class="subtitle">{{ subtitle }}</p>

        <div v-if="selectedCount > 0" class="selection-note">
          <i class="fas fa-check-square"></i>
          Solo se exportarán los <strong>{{ selectedCount }}</strong> productos seleccionados.
        </div>

        <div class="field">
          <label>Sucursal / Destino</label>
          <SearchableSelect v-model="destination" :options="destinationOptions" placeholder="Elige la sucursal..." search-placeholder="Buscar sucursal..." />
        </div>

        <div class="field">
          <label>Fecha de entrega</label>
          <div class="date-pills">
            <button type="button" :class="{ active: !allDates && date === getECTTodayString() }" @click="quickDate(getECTTodayString())">Hoy</button>
            <button type="button" :class="{ active: !allDates && date === tomorrowStr() }" @click="quickDate(tomorrowStr())">Mañana</button>
            <button type="button" :class="{ active: allDates }" @click="allDates = true">Todas</button>
          </div>
          <CustomDatePicker
            v-if="!allDates"
            :model-value="date"
            placeholder="Otra fecha"
            @update:model-value="quickDate($event)"
          />
        </div>

        <div v-if="mode === 'production'" class="field">
          <label>Nombre del responsable <span class="optional">(opcional)</span></label>
          <input v-model="responsibleName" type="text" placeholder="Ej: Juan Pérez" @keyup.enter="confirm" />
        </div>

        <p class="preview-line" :class="{ empty: previewCount === 0 }">
          <i :class="previewCount === 0 ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-info'"></i>
          <span v-if="previewCount === null || previewCount === undefined">Calculando qué se va a exportar…</span>
          <span v-else-if="previewCount === 0">
            No hay pedidos con esta fecha y sucursal. Cambia la fecha, elige
            <strong>Todas las sucursales</strong> o marca <strong>todas las fechas</strong>.
          </span>
          <span v-else>Se exportarán <strong>{{ previewCount }}</strong> pedido(s).</span>
        </p>

        <div class="actions">
          <button class="btn-cancel" :disabled="isLoading" @click="emit('close')">Cancelar</button>
          <button class="btn-confirm" :class="mode" :disabled="isLoading" @click="confirm">
            <i class="fas" :class="isLoading ? 'fa-spinner fa-spin' : 'fa-file-excel'"></i>
            {{ isLoading ? 'Exportando...' : 'Exportar Excel' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.export-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 1rem;
}

.preview-line {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0 0 1rem;
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0369a1;
  font-size: 0.82rem;
  line-height: 1.45;

  i { margin-top: 2px; flex-shrink: 0; }

  &.empty {
    background: #fffbeb;
    border-color: #fde68a;
    color: #92400e;
  }
}

.optional {
  font-weight: 600;
  color: #94a3b8;
  text-transform: none;
  letter-spacing: 0;
}

.export-card {
  background: white;
  padding: 1.75rem;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);

  h2 {
    margin: 0 0 0.3rem;
    color: #1e293b;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .subtitle {
    margin: 0 0 1.25rem;
    font-size: 0.85rem;
    color: #64748b;
  }
}

.selection-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  color: #6d28d9;
  font-size: 0.82rem;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
}

.field {
  margin-bottom: 1rem;

  label {
    display: block;
    margin-bottom: 0.4rem;
    font-weight: 700;
    font-size: 0.8rem;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  select,
  input {
    width: 100%;
    padding: 0.65rem 0.75rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.95rem;
    color: #0f172a;
    background: white;

    &:focus { outline: none; border-color: #8e44ad; }
    &:disabled { background: #f8fafc; color: #94a3b8; }
  }
}

.date-pills {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;

  button {
    flex: 1;
    padding: 0.45rem;
    border-radius: 8px;
    border: 1.5px solid #e2e8f0;
    background: white;
    color: #64748b;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;

    &:hover { border-color: #94a3b8; }
    &.active { background: #1e293b; border-color: #1e293b; color: white; }
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;

  button {
    padding: 0.7rem 1.3rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &:disabled { opacity: 0.55; cursor: not-allowed; }
  }

  .btn-cancel {
    background: #f1f2f6;
    color: #7f8c8d;
    &:hover:not(:disabled) { background: #e1e2e6; }
  }

  .btn-confirm {
    color: white;

    &.production { background: #e67e22; &:hover:not(:disabled) { background: darken(#e67e22, 6%); } }
    &.dispatch { background: #3498db; &:hover:not(:disabled) { background: darken(#3498db, 6%); } }
  }
}

.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
