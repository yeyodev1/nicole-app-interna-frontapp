<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
import { DISCARD_REASONS } from '@/utils/reserva'

/** Confirmación de "Eliminar" con motivo opcional. El borrado es lógico: pasa a Descartadas. */
const props = defineProps<{
  /** Nombre del cliente si es una sola reserva. */
  customerName?: string
  count: number
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', payload: { reason?: string; note?: string }): void
}>()

const reason = shallowRef<string | undefined>()
const note = shallowRef('')
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')

const title = computed(() =>
  props.count === 1 ? `¿Eliminar la reserva de ${props.customerName}?` : `¿Eliminar ${props.count} reservas?`
)

function toggleReason(value: string) {
  reason.value = reason.value === value ? undefined : value
}

function confirm() {
  emit('confirm', {
    ...(reason.value ? { reason: reason.value } : {}),
    ...(reason.value === 'other' && note.value.trim() ? { note: note.value.trim() } : {})
  })
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && !props.busy) emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
  // El foco arranca en Cancelar: Enter por reflejo no elimina nada.
  cancelButton.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click.self="!busy && emit('close')">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="reserva-discard-title">
        <h2 id="reserva-discard-title">{{ title }}</h2>
        <p class="lead">
          Sale de la lista y queda en Descartadas, de donde se puede recuperar. Al cliente no le llega ningún aviso.
        </p>

        <fieldset class="reasons">
          <legend>Motivo (opcional)</legend>
          <div class="options">
            <button
              v-for="option in DISCARD_REASONS"
              :key="option.value"
              type="button"
              class="option"
              :class="{ on: reason === option.value }"
              :aria-pressed="reason === option.value"
              @click="toggleReason(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </fieldset>

        <label v-if="reason === 'other'" class="note">
          <span>¿Qué pasó?</span>
          <textarea v-model="note" rows="2" maxlength="500" placeholder="Ej.: compró en una isla"></textarea>
        </label>

        <div class="buttons">
          <button ref="cancelButton" type="button" class="btn" :disabled="busy" @click="emit('close')">Cancelar</button>
          <button type="button" class="btn danger" :disabled="busy" @click="confirm">
            <i v-if="busy" class="fa-solid fa-spinner fa-spin"></i>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
$ink: #1e1b24;
$muted: #6b6475;
$line: #ece7ef;

.overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(30, 27, 36, 0.45);
  animation: fade 0.15s ease;
}

.modal {
  width: 100%;
  max-width: 440px;
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  padding: 1.35rem;
  border-radius: 16px;
  background: white;

  h2 {
    margin: 0;
    color: $ink;
    font-size: 1.12rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
}

.lead {
  margin: 0.5rem 0 1.1rem;
  color: $muted;
  font-size: 0.88rem;
  line-height: 1.45;
}

.reasons {
  margin: 0;
  padding: 0;
  border: none;

  legend {
    margin-bottom: 0.45rem;
    padding: 0;
    color: $ink;
    font-size: 0.82rem;
    font-weight: 700;
  }
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.option {
  min-height: 40px;
  padding: 0.4rem 0.8rem;
  border: 1px solid $line;
  border-radius: 999px;
  background: white;
  color: #4b4453;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;

  &:hover { border-color: #d9d2df; background: #f7f4f9; }
  &.on {
    border-color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.09);
    color: $NICOLE-PURPLE;
  }
  &:focus-visible { outline: 2px solid $NICOLE-PURPLE; outline-offset: 2px; }
}

.note {
  display: block;
  margin-top: 0.85rem;

  span {
    display: block;
    margin-bottom: 0.3rem;
    color: $ink;
    font-size: 0.82rem;
    font-weight: 700;
  }

  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid $line;
    border-radius: 10px;
    font: inherit;
    font-size: 0.9rem;
    resize: vertical;

    &:focus { outline: 2px solid $NICOLE-PURPLE; outline-offset: 1px; }
  }
}

.buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 42px;
  padding: 0.5rem 1rem;
  border: 1px solid $line;
  border-radius: 10px;
  background: white;
  color: #4b4453;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;

  &:hover:not(:disabled) { background: #f7f4f9; }
  &:focus-visible { outline: 2px solid $NICOLE-PURPLE; outline-offset: 2px; }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
}

.danger {
  border-color: #b91c1c;
  background: #b91c1c;
  color: white;

  &:hover:not(:disabled) { background: #991b1b; }
}

@keyframes fade {
  from { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .overlay { animation: none; }
}
</style>
