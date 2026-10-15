<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDialog } from '@/composables/useDialog'

const { queue, respond } = useDialog()

const current = computed(() => queue.value[0] ?? null)
const inputValue = ref('')
const inputError = ref('')

watch(current, (val) => {
  if (val) {
    inputValue.value = val.options.defaultValue ?? ''
    inputError.value = ''
  }
})

const variantConfig = computed(() => {
  const variant = current.value?.options.variant
    ?? (current.value?.type === 'prompt' ? 'info' : current.value?.type === 'confirm' ? 'warning' : 'error')

  return {
    info: { icon: 'fa-circle-info', color: '#0284c7', bg: '#e0f2fe' },
    warning: { icon: 'fa-triangle-exclamation', color: '#d97706', bg: '#fef3c7' },
    error: { icon: 'fa-circle-xmark', color: '#dc2626', bg: '#fee2e2' },
    success: { icon: 'fa-circle-check', color: '#16a34a', bg: '#dcfce7' },
  }[variant as string] ?? { icon: 'fa-circle-info', color: '#0284c7', bg: '#e0f2fe' }
})

const confirmLabel = computed(() => current.value?.options.confirmLabel ?? 'Aceptar')
const cancelLabel = computed(() => current.value?.options.cancelLabel ?? 'Cancelar')
const title = computed(() => current.value?.options.title ?? null)

const handleConfirm = () => {
  if (!current.value) return
  if (current.value.type === 'prompt') {
    if (!inputValue.value.trim()) {
      inputError.value = 'Este campo es requerido.'
      return
    }
    respond(inputValue.value.trim())
  } else if (current.value.type === 'confirm') {
    respond(true)
  } else {
    respond(undefined)
  }
}

const handleCancel = () => {
  if (!current.value) return
  if (current.value.type === 'confirm') respond(false)
  else if (current.value.type === 'prompt') respond(null)
}

const onKeydown = (e: KeyboardEvent) => {
  if (!current.value) return
  if (e.key === 'Enter' && current.value.type !== 'prompt') handleConfirm()
  if (e.key === 'Escape' && current.value.type !== 'alert') handleCancel()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Transition name="dialog-fade">
    <div v-if="current" class="dialog-overlay" @click.self="current.type !== 'alert' && handleCancel()">
      <Transition name="dialog-scale" appear>
        <div class="dialog-box" role="dialog" :aria-modal="true">

          <!-- Icon -->
          <div class="dialog-icon" :style="{ background: variantConfig.bg, color: variantConfig.color }">
            <i class="fas" :class="variantConfig.icon"></i>
          </div>

          <!-- Title -->
          <h3 v-if="title" class="dialog-title">{{ title }}</h3>

          <!-- Message -->
          <p class="dialog-message" v-html="current.message"></p>

          <!-- Prompt Input -->
          <div v-if="current.type === 'prompt'" class="dialog-input-group">
            <textarea
              v-model="inputValue"
              class="dialog-textarea"
              :class="{ 'has-error': inputError }"
              :placeholder="current.options.placeholder ?? ''"
              rows="3"
              autofocus
              @keydown.enter.ctrl="handleConfirm"
            ></textarea>
            <span v-if="inputError" class="input-error">{{ inputError }}</span>
          </div>

          <!-- Actions -->
          <div class="dialog-actions" :class="{ 'single': current.type === 'alert' }">
            <button
              v-if="current.type !== 'alert'"
              class="btn-cancel"
              @click="handleCancel"
            >
              {{ cancelLabel }}
            </button>
            <button
              class="btn-confirm"
              :class="{ 'full-width': current.type === 'alert' }"
              @click="handleConfirm"
            >
              {{ confirmLabel }}
            </button>
          </div>

        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.dialog-box {
  background: white;
  border-radius: 20px;
  padding: 2rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.dialog-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  flex-shrink: 0;
}

.dialog-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: $text-dark;
  font-family: $font-principal;
}

.dialog-message {
  white-space: pre-line;
  margin: 0;
  color: $text-light;
  font-size: 0.95rem;
  line-height: 1.6;
  text-align: center;
  word-break: break-word;
}

.dialog-input-group {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-align: left;
}

.dialog-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1.5px solid $border-light;
  border-radius: 10px;
  font-family: inherit;
  font-size: 0.95rem;
  resize: vertical;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: $NICOLE-PURPLE;
  }

  &.has-error {
    border-color: #dc2626;
  }
}

.input-error {
  font-size: 0.8rem;
  color: #dc2626;
  font-weight: 500;
}

.dialog-actions {
  width: 100%;
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;

  &.single {
    justify-content: center;
  }

  button {
    flex: 1;
    padding: 0.8rem 1.25rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    border: none;
    transition: all 0.2s;

    &.full-width {
      max-width: 180px;
    }
  }

  .btn-cancel {
    background: $gray-100;
    color: $text-light;

    &:hover {
      background: $gray-200;
      color: $text-dark;
    }
  }

  .btn-confirm {
    background: $NICOLE-PURPLE;
    color: white;

    &:hover {
      opacity: 0.88;
    }
  }
}

/* Transitions */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active {
  transition: all 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.dialog-scale-leave-active {
  transition: all 0.18s ease;
}

.dialog-scale-enter-from {
  opacity: 0;
  transform: scale(0.88);
}

.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
