<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps<{
  modelValue: string // YYYY-MM-DD
  label?: string
  placeholder?: string
  minDate?: string // YYYY-MM-DD
  maxDate?: string // YYYY-MM-DD (ej. reportes: solo hasta hoy)
  required?: boolean
  disabled?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

// Calendar State
const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())

// Sync with modelValue if preset
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    const d = new Date(newVal + 'T00:00:00') // Force local time
    if (!isNaN(d.getTime())) {
      currentMonth.value = d.getMonth()
      currentYear.value = d.getFullYear()
    }
  }
}, { immediate: true })

const monthName = computed(() => {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    month: 'long',
    year: 'numeric'
  }).format(new Date(currentYear.value, currentMonth.value))
})

const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

const calendarDays = computed(() => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)

  const startingDayOfWeek = firstDay.getDay() // 0 = Sunday
  const daysInMonth = lastDay.getDate()

  const calendar: Array<{ day: number | null, fullDate: string, disabled: boolean }> = []

  // Padding
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendar.push({ day: null, fullDate: '', disabled: true })
  }

  const now = new Date()
  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)

  const yPart = todayParts.find(p => p.type === 'year')?.value
  const mPart = todayParts.find(p => p.type === 'month')?.value
  const dPart = todayParts.find(p => p.type === 'day')?.value
  const todayStr = `${yPart}-${mPart}-${dPart}`
  const min = props.minDate || todayStr // Default min is today if not provided? Or can be empty.

  // Real Days
  for (let d = 1; d <= daysInMonth; d++) {
    const fullDate = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    // Check constraints
    let isDisabled = false
    if (props.minDate && fullDate < props.minDate) isDisabled = true
    if (props.maxDate && fullDate > props.maxDate) isDisabled = true

    calendar.push({ day: d, fullDate, disabled: isDisabled })
  }

  return calendar
})

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

const selectDate = (dateVal: string) => {
  emit('update:modelValue', dateVal)
  isOpen.value = false
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

      const top = spaceBelow < 320
        ? `${Math.max(8, rect.top - 328)}px`
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

const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder || 'Seleccionar fecha'

  // Create date object treating it as Ecuador local time
  const [y, m, d] = props.modelValue.split('-').map(Number)
  if (!y || !m || !d) return props.modelValue

  // We use the Intl formatter to show it nicely in es-EC
  const dateObj = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'long'
  }).format(dateObj)
})
</script>

<template>
  <div class="custom-date-picker" ref="wrapperRef">
    <label v-if="label" class="label" :class="{ required }">{{ label }}</label>
    
    <div
      ref="triggerRef"
      class="picker-trigger"
      :class="{ 'is-open': isOpen, disabled, 'has-value': !!modelValue }"
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
          <span v-for="d in days" :key="d">{{ d }}</span>
        </div>
        
        <div class="days-grid">
           <div 
             v-for="(cell, i) in calendarDays" 
             :key="i"
             class="day-cell"
             :class="{
              empty: !cell.day,
              disabled: cell.disabled,
              selected: modelValue === cell.fullDate,
              today: cell.fullDate === new Date().toISOString().split('T')[0]
            }"
             @click.stop="cell.day && !cell.disabled && selectDate(cell.fullDate)"
           >
             {{ cell.day }}
           </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
.custom-date-picker {
  position: relative;
  width: 100%;
}

.label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: $text-dark;
  margin-bottom: 0.5rem;

  &.required::after {
    content: " *";
    color: $error;
  }
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
    font-size: 0.95rem;
    color: $text-light;
    text-transform: capitalize;

    @at-root .has-value .value-text {
      color: $text-dark;
      font-weight: 500;
    }
  }

  .icon {
    color: $text-light;
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
  gap: 4px;
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
  transition: all 0.2s;

  &:hover:not(.empty):not(.disabled) {
    background: $gray-50;
    color: $NICOLE-PURPLE;
  }

  &.selected {
    background: $NICOLE-PURPLE !important;
    color: white !important;
    font-weight: 700;
    box-shadow: 0 4px 10px rgba($NICOLE-PURPLE, 0.3);
  }

  &.disabled {
    color: $gray-300;
    cursor: not-allowed;
  }

  &.today {
    border: 1px solid $NICOLE-PURPLE;
    color: $NICOLE-PURPLE;
    font-weight: 700;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
