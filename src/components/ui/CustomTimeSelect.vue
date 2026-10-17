<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: string
  label?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  options: string[] // List of time strings "HH:MM"
  hint?: string
  emptyText?: string // Se muestra si no hay horarios (p. ej. hoy ya pasó el cierre)
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)

const toggleDropdown = () => {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
  }
}

const selectTime = (time: string) => {
  emit('update:modelValue', time)
  isOpen.value = false
}

// Click outside to close
const handleClickOutside = (event: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder || 'Seleccionar hora'
  return props.modelValue
})
</script>

<template>
  <div class="custom-time-select" ref="wrapperRef">
    <label v-if="label" class="label" :class="{ required }">
      {{ label }}
    </label>
    
    <div 
      class="select-trigger" 
      :class="{ 'is-open': isOpen, disabled, 'has-value': !!modelValue }"
      @click="toggleDropdown"
    >
      <span class="value-text">{{ displayValue }}</span>
      <i class="fa-regular fa-clock icon"></i>
    </div>

    <transition name="fade">
      <div v-if="isOpen" class="dropdown-menu">
         <p v-if="!options.length" class="empty">{{ emptyText || 'No hay horarios disponibles.' }}</p>
         <div v-else class="time-grid">
           <button 
             v-for="time in options" 
             :key="time" 
             class="time-option"
             :class="{ selected: modelValue === time }"
             @click.stop="selectTime(time)"
           >
             {{ time }}
           </button>
         </div>
      </div>
    </transition>
    
    <small v-if="hint" class="hint">{{ hint }}</small>
  </div>
</template>

<style lang="scss" scoped>
.custom-time-select {
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

.select-trigger {
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

    @at-root .has-value .value-text {
      color: $text-dark;
      font-weight: 500;
    }
  }

  .icon {
    color: $text-light;
    font-size: 1.1rem;
  }
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  width: 100%;
  max-width: 350px; // Prevent super wide on desktop
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid $border-light;
  z-index: 50;
  padding: 1rem;
  animation: slideDown 0.2s ease;

  @media(max-width: 500px) {
    width: 100%;
    max-width: none;
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  }
}

.time-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: $gray-300;
    border-radius: 2px;
  }
}

.time-option {
  background: $gray-50;
  border: 1px solid transparent;
  padding: 0.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  color: $text-dark;
  transition: all 0.2s;

  &:hover {
    background: white;
    border-color: $NICOLE-PURPLE;
    color: $NICOLE-PURPLE;
  }

  &.selected {
    background: $NICOLE-PURPLE;
    color: white;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba($NICOLE-PURPLE, 0.3);
  }
}

.empty {
  margin: 0;
  font-size: 0.9rem;
  color: $text-light;
  line-height: 1.4;
}

.hint {
  display: block;
  font-size: 0.8rem;
  color: $text-light;
  margin-top: 0.35rem;
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
