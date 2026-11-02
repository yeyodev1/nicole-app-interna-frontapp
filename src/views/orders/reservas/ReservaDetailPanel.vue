<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useReservaActions } from '@/composables/useReservaActions'
import { STATE_META, discardReasonLabel, formatContactTime, hasPayment, reservaState } from '@/utils/reserva'
import ReservaActions from './ReservaActions.vue'
import ReservaDiscardModal from './ReservaDiscardModal.vue'

/** Seguimiento de la reserva dentro del detalle del pedido. */
const props = defineProps<{ order: any }>()
const emit = defineEmits<{ (e: 'updated'): void }>()

const actions = useReservaActions(() => emit('updated'))
const showDiscard = shallowRef(false)

const state = computed(() => reservaState(props.order))
const meta = computed(() => STATE_META[state.value])
const isBusy = computed(() => actions.busyId.value !== null)
const contacts = computed<any[]>(() => [...(props.order.webOrder?.contactLog || [])].reverse())
const discard = computed(() => props.order.webOrder?.discard)
const needsPayment = computed(() => state.value === 'contacted' && !hasPayment(props.order))
const customerName = computed(() => props.order.webOrder?.buyer?.name || props.order.customerName)

async function confirmDiscard(payload: { reason?: string; note?: string }) {
  if (await actions.discard([props.order._id], payload)) showDiscard.value = false
}
</script>

<template>
  <section class="panel">
    <div class="head">
      <h2><i class="fa-regular fa-comments"></i> Seguimiento de la reserva</h2>
      <span class="chip" :class="`t-${meta.tone}`">{{ meta.label }}</span>
    </div>

    <p v-if="discard?.at" class="line">
      Descartada por {{ discard.by }}, {{ formatContactTime(discard.at) }}<template v-if="discard.reason"> · {{ discardReasonLabel(discard.reason) }}</template>
      <em v-if="discard.note">{{ discard.note }}</em>
    </p>

    <ol v-if="contacts.length > 0" class="contacts">
      <li v-for="contact in contacts" :key="contact.at">
        Contactado por {{ contact.by }}, {{ formatContactTime(contact.at) }}
        <em v-if="contact.note">{{ contact.note }}</em>
      </li>
    </ol>
    <p v-else-if="state === 'pending'" class="line">Todavía nadie contacta a este cliente.</p>

    <p v-if="needsPayment" class="hint">
      <i class="fa-solid fa-circle-info"></i>
      Registra el cobro en este pedido para poder marcar la reserva como gestionada.
    </p>

    <ReservaActions
      :order="order"
      :busy="isBusy"
      in-detail
      @contact="actions.contact(order)"
      @new-contact="actions.newContact(order)"
      @note="actions.editNote(order)"
      @undo="actions.undoContact(order)"
      @managed="actions.markManaged(order)"
      @discard="showDiscard = true"
      @restore="actions.restore(order)"
    />

    <ReservaDiscardModal
      v-if="showDiscard"
      :count="1"
      :customer-name="customerName"
      :busy="isBusy"
      @close="showDiscard = false"
      @confirm="confirmDiscard"
    />
  </section>
</template>

<style lang="scss" scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-sizing: border-box;
  width: 100%;
  padding: 1.25rem;
  border: 1px solid $border-light;
  border-radius: 12px;
  background: white;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;

  h2 {
    margin: 0;
    font-size: 1.05rem;
  }
}

.chip {
  padding: 0.2rem 0.6rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 800;

  &.t-warn { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  &.t-info { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  &.t-ok { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
  &.t-muted { background: #f4f2f6; color: #5f5868; border-color: #ece7ef; }
}

.line {
  margin: 0;
  color: #4b4453;
  font-size: 0.88rem;
}

em {
  display: block;
  color: #1e1b24;
  font-style: normal;
  font-weight: 600;
}

.contacts {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    padding: 0.5rem 0.65rem;
    border-radius: 10px;
    background: #f7f4f9;
    color: #4b4453;
    font-size: 0.85rem;
    line-height: 1.4;
  }
}

.hint {
  display: flex;
  gap: 0.45rem;
  margin: 0;
  color: #b45309;
  font-size: 0.85rem;

  i { margin-top: 0.2rem; }
}
</style>
