import { ref, computed } from 'vue'

export interface CalendarCell {
  day: number | null
  fullDate: string
  disabled: boolean
}

/**
 * Lógica de calendario mensual compartida por los date pickers
 * (grilla de días, navegación de mes, hoy en hora de Ecuador).
 */
export function useCalendarGrid(options?: {
  minDate?: () => string | undefined
  maxDate?: () => string | undefined
}) {
  const currentMonth = ref(new Date().getMonth())
  const currentYear = ref(new Date().getFullYear())

  const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

  const todayStr = computed(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date())
    const y = parts.find(p => p.type === 'year')?.value
    const m = parts.find(p => p.type === 'month')?.value
    const d = parts.find(p => p.type === 'day')?.value
    return `${y}-${m}-${d}`
  })

  const monthName = computed(() => {
    return new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      month: 'long',
      year: 'numeric'
    }).format(new Date(currentYear.value, currentMonth.value))
  })

  const calendarDays = computed<CalendarCell[]>(() => {
    const firstDay = new Date(currentYear.value, currentMonth.value, 1)
    const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)
    const minDate = options?.minDate?.()
    const maxDate = options?.maxDate?.()

    const calendar: CalendarCell[] = []
    for (let i = 0; i < firstDay.getDay(); i++) {
      calendar.push({ day: null, fullDate: '', disabled: true })
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const fullDate = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      let isDisabled = false
      if (minDate && fullDate < minDate) isDisabled = true
      if (maxDate && fullDate > maxDate) isDisabled = true
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

  /** Posiciona la vista del calendario en el mes de una fecha YYYY-MM-DD. */
  const goToDate = (dateStr: string) => {
    if (!dateStr) return
    const d = new Date(dateStr + 'T00:00:00')
    if (!isNaN(d.getTime())) {
      currentMonth.value = d.getMonth()
      currentYear.value = d.getFullYear()
    }
  }

  return {
    currentMonth,
    currentYear,
    weekDays,
    todayStr,
    monthName,
    calendarDays,
    prevMonth,
    nextMonth,
    goToDate
  }
}
