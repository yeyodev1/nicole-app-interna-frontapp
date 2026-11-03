<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { canDiscard, hasPayment, reservaState } from '@/utils/reserva'

/** Botones de una reserva según su estado. Se usa en la tarjeta y en el detalle. */
const props = defineProps<{
  order: any
  busy: boolean
  /** En el detalle el cobro se registra en la misma página. */
  inDetail?: boolean
}>()

const emit = defineEmits<{
  (e: 'contact'): void
  (e: 'new-contact'): void
  (e: 'note'): void
  (e: 'undo'): void
  (e: 'managed'): void
  (e: 'discard'): void
  (e: 'restore'): void
}>()

const state = computed(() => reservaState(props.order))
const isPaid = computed(() => hasPayment(props.order))
const hasContact = computed(() => (props.order.webOrder?.contactLog || []).length > 0)
const removable = computed(() => canDiscard(props.order))

const router = useRouter()
const goToDetail = () => router.push({ name: 'order-detail', params: { id: props.order._id } })
</script>

<template>
  <div class="actions">
    <button v-if="state === 'pending'" type="button" class="btn primary" :disabled="busy" @click="emit('contact')">
      <i class="fa-solid" :class="busy ? 'fa-spinner fa-spin' : 'fa-check'"></i> Contactado
    </button>

    <template v-else-if="state === 'contacted'">
      <button v-if="isPaid" type="button" class="btn primary" :disabled="busy" @click="emit('managed')">
        <i class="fa-solid" :class="busy ? 'fa-spinner fa-spin' : 'fa-check-double'"></i> Marcar gestionada
      </button>
      <button v-else-if="!inDetail" type="button" class="btn primary" @click="goToDetail">
        <i class="fa-solid fa-dollar-sign"></i> Registrar cobro
      </button>
      <button type="button" class="btn" :disabled="busy" @click="emit('new-contact')">
        <i class="fa-solid fa-phone"></i> Otro contacto
      </button>
      <button v-if="hasContact" type="button" class="btn" :disabled="busy" @click="emit('note')">
        <i class="fa-regular fa-note-sticky"></i> Nota
      </button>
      <button v-if="hasContact" type="button" class="btn" :disabled="busy" @click="emit('undo')">
        <i class="fa-solid fa-rotate-left"></i> Deshacer
      </button>
    </template>

    <button v-else-if="state === 'discarded'" type="button" class="btn primary" :disabled="busy" @click="emit('restore')">
      <i class="fa-solid" :class="busy ? 'fa-spinner fa-spin' : 'fa-rotate-left'"></i> Recuperar
    </button>

    <button v-if="removable" type="button" class="btn danger" :disabled="busy" @click="emit('discard')">
      <i class="fa-regular fa-trash-can"></i> Eliminar
    </button>
  </div>
</template>

<style lang="scss" scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 40px;
  padding: 0.45rem 0.75rem;
  border: 1px solid #ece7ef;
  border-radius: 10px;
  background: white;
  color: #4b4453;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    background: #f7f4f9;
    border-color: #d9d2df;
  }

  &:focus-visible {
    outline: 2px solid $NICOLE-PURPLE;
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.primary {
  flex: 1 1 100%;
  border-color: $NICOLE-PURPLE;
  background: $NICOLE-PURPLE;
  color: white;

  &:hover:not(:disabled) {
    background: #6c2360;
    border-color: #6c2360;
    color: white;
  }
}

.danger {
  margin-left: auto;
  color: #b91c1c;

  &:hover:not(:disabled) {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn {
    transition: none;
  }
}
</style>
