<script setup lang="ts">
import { ref } from 'vue'

// Ayer / Hoy / Mañana / Próximos días, o un día específico ('date')
const mode = defineModel<string>('mode', { required: true })
const date = defineModel<string>('date', { required: true })

const dateInput = ref<HTMLInputElement | null>(null)

const quickModes = [
  { key: 'yesterday', label: 'Ayer' },
  { key: 'today', label: 'Hoy' },
  { key: 'tomorrow', label: 'Mañana' },
  { key: 'future', label: 'Próximos Días' },
]

const formatDate = (value: string) => {
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

const openPicker = () => {
  const input = dateInput.value
  if (!input) return
  try {
    input.showPicker()
  } catch {
    input.focus()
  }
}

const onDateChange = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  if (!value) return
  date.value = value
  mode.value = 'date'
}
</script>

<template>
  <div class="filter-bar-container">
    <div class="filter-bar">
      <button
        v-for="q in quickModes"
        :key="q.key"
        class="filter-pill"
        :class="{ active: mode === q.key }"
        @click="mode = q.key"
      >
        {{ q.label }}
      </button>

      <label class="filter-pill date-pill" :class="{ active: mode === 'date' }" @click.prevent="openPicker">
        <i class="fas fa-calendar-alt"></i>
        <span>{{ mode === 'date' && date ? formatDate(date) : 'Elegir fecha' }}</span>
        <input
          ref="dateInput"
          type="date"
          class="date-input"
          :value="date"
          @change="onDateChange"
        />
      </label>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.filter-bar-container {
  margin-bottom: 2rem;
  background: white;
  padding: 0.5rem;
  border-radius: 14px;
  display: inline-flex;
  max-width: 100%;
  overflow-x: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
  border: 1px solid #f1f2f6;

  .filter-bar {
    display: flex;
    gap: 0.25rem;

    .filter-pill {
      background: transparent;
      border: none;
      color: #7f8c8d;
      padding: 0.6rem 1.4rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        background: #f8f9fa;
        color: #2c3e50;
      }

      &.active {
        background: #2c3e50;
        color: white;
        box-shadow: 0 4px 10px rgba(52, 73, 94, 0.15);
      }
    }

    .date-pill {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      border: 1px dashed #dfe4ea;

      &.active {
        border-color: transparent;
      }
    }

    // Invisible pero presente: el selector nativo se abre con showPicker()
    .date-input {
      position: absolute;
      inset: 0;
      opacity: 0;
      pointer-events: none;
    }
  }
}

@media (max-width: 768px) {
  .filter-bar-container {
    width: 100%;
  }
}
</style>
