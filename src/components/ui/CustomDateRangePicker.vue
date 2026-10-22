<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useCalendarGrid } from '@/composables/useCalendarGrid'

const props = defineProps<{
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD ('' = un solo día)
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits(['update:start', 'update:end'])

const isOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})
const hoverDate = ref('')

const { weekDays, todayStr, monthName, calendarDays, prevMonth, nextMonth, goToDate } = useCalendarGrid()

watch(() => props.start, (val) => goToDate(val), { immediate: true })

const selectDate = (dateVal: string) => {
  // Primer clic (o rango ya completo): reinicia el rango
  if (!props.start || props.end) {
    emit('update:start', dateVal)
    emit('update:end', '')
    return
  }
  // Segundo clic: cierra el rango (swap si eligió hacia atrás)
  if (dateVal < props.start) {
    emit('update:end', props.start)
    emit('update:start', dateVal)
  } else {
    emit('update:end', dateVal)
  }
  isOpen.value = false
}

const clearRange = () => {
  emit('update:start', '')
  emit('update:end', '')
}

const rangeEnd = computed(() => props.end || (props.start && hoverDate.value >= props.start ? hoverDate.value : ''))

const isInRange = (fullDate: string) => {
  if (!props.start || !rangeEnd.value) return false
  return fullDate > props.start && fullDate < rangeEnd.value
}

const toggleDropdown = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      if (!triggerRef.value) return
      const rect = triggerRef.value.getBoundingClientRect()
      const dropW = Math.min(280, window.innerWidth - 16)
      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow < 360
        ? `${Math.max(8, rect.top - 368)}px`
        : `${rect.bottom + 6}px`
      let left = rect.left
      if (left + dropW > window.innerWidth - 8) left = window.innerWidth - dropW - 8
      if (left < 8) left = 8
      dropdownStyle.value = { top, left: `${left}px`, width: `${dropW}px` }
    })
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

const formatShort = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(y, m - 1, d))
}

const displayValue = computed(() => {
  if (!props.start) return props.placeholder || 'Seleccionar fechas'
  if (!props.end || props.end === props.start) return formatShort(props.start)
  return `${formatShort(props.start)} — ${formatShort(props.end)}`
})

const hint = computed(() => {
  if (props.start && !props.end) return 'Elige la fecha final (o la misma para un solo día)'
  return 'Elige la fecha inicial'
})
</script>

<template>
  <div class="custom-date-range-picker" ref="wrapperRef">
    <div
      ref="triggerRef"
      class="picker-trigger"
      :class="{ 'is-open': isOpen, disabled, 'has-value': !!start }"
      @click="toggleDropdown"
    >
      <span class="value-text">{{ displayValue }}</span>
      <i class="fa-regular fa-calendar icon"></i>
    </div>

    <transition name="fade">
      <div v-if="isOpen" class="calendar-dropdown" :style="dropdownStyle">
        <div class="calendar-header">
          <button @click.stop="prevMonth" type="button"><i class="fa-solid fa-chevron-left"></i></button>
          <span class="curr-month">{{ monthName }}</span>
          <button @click.stop="nextMonth" type="button"><i class="fa-solid fa-chevron-right"></i></button>
        </div>

        <div class="weekdays">
          <span v-for="(d, i) in weekDays" :key="i">{{ d }}</span>
        </div>

        <div class="days-grid" @mouseleave="hoverDate = ''">
          <div
            v-for="(cell, i) in calendarDays"
            :key="i"
            class="day-cell"
            :class="{
              empty: !cell.day,
              disabled: cell.disabled,
              'range-start': start && cell.fullDate === start,
              'range-end': end && cell.fullDate === end,
              'in-range': cell.day ? isInRange(cell.fullDate) : false,
              today: cell.fullDate === todayStr
            }"
            @mouseenter="cell.day && (hoverDate = cell.fullDate)"
            @click.stop="cell.day && !cell.disabled && selectDate(cell.fullDate)"
          >
            {{ cell.day }}
          </div>
        </div>

        <div class="calendar-footer">
          <span class="hint">{{ hint }}</span>
          <button v-if="start" type="button" class="btn-clear" @click.stop="clearRange">
            Limpiar
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
.custom-date-range-picker {
  position: relative;
  width: 100%;
}

.picker-trigger {
  width: 100%;
  padding: 0.85rem 1rem;
  background: white;
  border: 1px solid $border-light;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  transition: all 0.2s;
  user-select: none;
  font-family: $font-secondary;

  &:hover {
    border-color: darken-color($border-light, 10%);
    background: $gray-50;
  }

  &.is-open {
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
  }

  &.disabled {
    background: $gray-100;
    pointer-events: none;
    opacity: 0.7;
  }

  .value-text {
    font-size: 0.9rem;
    color: $text-light;
    text-transform: capitalize;
  }

  &.has-value .value-text {
    color: $text-dark;
    font-weight: 500;
  }

  .icon {
    color: $text-light;
    flex-shrink: 0;
  }
}

.calendar-dropdown {
  position: fixed;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.14);
  border: 1px solid $border-light;
  z-index: 9999;
  padding: 1rem;
  animation: slideDown 0.18s ease;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  .curr-month {
    font-weight: 700;
    text-transform: capitalize;
    color: $NICOLE-PURPLE;
    font-size: 1rem;
  }

  button {
    background: transparent;
    border: none;
    color: $text-light;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;

    &:hover {
      background: $gray-50;
      color: $NICOLE-PURPLE;
    }
  }
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 0.5rem;
  text-align: center;

  span {
    font-size: 0.8rem;
    font-weight: 700;
    color: $text-light;
  }
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px 0;
}

.day-cell {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  color: $text-dark;
  transition: background 0.15s, color 0.15s;

  &:hover:not(.empty):not(.disabled) {
    background: $gray-50;
    color: $NICOLE-PURPLE;
  }

  &.in-range {
    background: rgba($NICOLE-PURPLE, 0.1);
    border-radius: 0;
  }

  &.range-start,
  &.range-end {
    background: $NICOLE-PURPLE !important;
    color: white !important;
    font-weight: 700;
    box-shadow: 0 4px 10px rgba($NICOLE-PURPLE, 0.3);
  }

  &.range-start { border-radius: 8px 0 0 8px; }
  &.range-end { border-radius: 0 8px 8px 0; }
  &.range-start.range-end { border-radius: 8px; }

  &.disabled {
    color: $gray-300;
    cursor: not-allowed;
  }

  &.today:not(.range-start):not(.range-end) {
    border: 1px solid $NICOLE-PURPLE;
    color: $NICOLE-PURPLE;
    font-weight: 700;
  }
}

.calendar-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.6rem;
  border-top: 1px solid $border-light;

  .hint {
    font-size: 0.72rem;
    color: $text-light;
  }

  .btn-clear {
    background: transparent;
    border: none;
    color: $NICOLE-PURPLE;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0.25rem 0.4rem;
    border-radius: 6px;
    flex-shrink: 0;

    &:hover { background: rgba($NICOLE-PURPLE, 0.08); }
  }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
