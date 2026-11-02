<script setup lang="ts">
import { computed } from 'vue'
import { parseECTDate } from '@/utils/dateUtils'
import {
  STATE_META,
  canDiscard,
  daysWaiting,
  discardReasonLabel,
  formatContactTime,
  reservaState,
  waNumber,
  waitingLabel
} from '@/utils/reserva'
import ReservaActions from './ReservaActions.vue'

const props = defineProps<{
  order: any
  selected: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-select'): void
  (e: 'contact'): void
  (e: 'new-contact'): void
  (e: 'note'): void
  (e: 'undo'): void
  (e: 'managed'): void
  (e: 'discard'): void
  (e: 'restore'): void
}>()

const web = computed(() => props.order.webOrder || {})
const state = computed(() => reservaState(props.order))
const meta = computed(() => STATE_META[state.value])
const selectable = computed(() => canDiscard(props.order))

// Se contacta a quien reservó; customerName/customerPhone son de quien recibe.
const contactName = computed(() => web.value.buyer?.name || props.order.customerName)
const contactPhone = computed<string>(() => web.value.buyer?.phone || props.order.customerPhone || '')

const contacts = computed<any[]>(() => web.value.contactLog || [])
const lastContact = computed(() => contacts.value[contacts.value.length - 1])
const isLate = computed(() => state.value === 'pending' && daysWaiting(props.order.createdAt) >= 2)

const products = computed(() =>
  (props.order.products || []).map((p: any) => `${p.quantity} × ${p.name}`).join(', ')
)
const delivery = computed(() => {
  if (!props.order.deliveryDate) return 'Sin fecha'
  return parseECTDate(props.order.deliveryDate).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })
})
const discardLine = computed(() => {
  const discard = web.value.discard
  if (!discard?.at) return ''
  const reason = discardReasonLabel(discard.reason)
  return `Por ${discard.by}, ${formatContactTime(discard.at)}${reason ? ` · ${reason}` : ''}`
})
</script>

<template>
  <article class="card" :class="[`edge-${meta.tone}`, { selected }]">
    <header class="head">
      <label v-if="selectable" class="pick">
        <input type="checkbox" :checked="selected" :aria-label="`Seleccionar la reserva de ${contactName}`" @change="emit('toggle-select')" />
      </label>
      <div class="who">
        <router-link class="name" :to="{ name: 'order-detail', params: { id: order._id } }">{{ contactName }}</router-link>
        <p class="sub">{{ web.code }} · {{ order.contificoSource === 'sucree' ? 'Sucrée' : 'Nicole' }}</p>
      </div>
      <strong class="total">${{ Number(order.totalValue || 0).toFixed(2) }}</strong>
    </header>

    <div class="status">
      <span class="chip" :class="`t-${meta.tone}`"><i class="fa-solid" :class="meta.icon"></i>{{ meta.label }}</span>
      <span class="age" :class="{ late: isLate }">{{ waitingLabel(order.createdAt) }}</span>
    </div>

    <p v-if="lastContact" class="log">
      <i class="fa-regular fa-comments"></i>
      <span>
        Contactado por {{ lastContact.by }}, {{ formatContactTime(lastContact.at) }}<template v-if="contacts.length > 1"> · {{ contacts.length }} contactos</template>
        <em v-if="lastContact.note">{{ lastContact.note }}</em>
      </span>
    </p>
    <p v-if="discardLine" class="log">
      <i class="fa-solid fa-box-archive"></i>
      <span>{{ discardLine }}<em v-if="web.discard.note">{{ web.discard.note }}</em></span>
    </p>

    <p class="products" :title="products">{{ products }}</p>
    <p class="meta"><i class="fa-regular fa-calendar"></i> Quiere recibir: {{ delivery }}</p>

    <div v-if="contactPhone" class="reach">
      <a :href="`tel:${contactPhone}`"><i class="fa-solid fa-phone"></i> {{ contactPhone }}</a>
      <a :href="`https://wa.me/${waNumber(contactPhone)}`" target="_blank" rel="noopener">
        <i class="fa-brands fa-whatsapp"></i> WhatsApp
      </a>
    </div>

    <ReservaActions
      class="footer"
      :order="order"
      :busy="busy"
      @contact="emit('contact')"
      @new-contact="emit('new-contact')"
      @note="emit('note')"
      @undo="emit('undo')"
      @managed="emit('managed')"
      @discard="emit('discard')"
      @restore="emit('restore')"
    />
  </article>
</template>

<style lang="scss" scoped>
$ink: #1e1b24;
$muted: #6b6475;
$line: #ece7ef;

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
  padding: 1.05rem 1.1rem;
  border: 1px solid $line;
  border-radius: 16px;
  background: white;

  // Misma franja de estado que las tarjetas de la lista de pedidos.
  &::before {
    content: '';
    position: absolute;
    left: -1px;
    top: 14px;
    bottom: 14px;
    width: 4px;
    border-radius: 0 4px 4px 0;
  }

  &.edge-warn::before { background: #f59e0b; }
  &.edge-info::before { background: #3b82f6; }
  &.edge-ok::before { background: #22c55e; }
  &.edge-muted::before { background: #cbc5d2; }
  &.selected { border-color: $NICOLE-PURPLE; }
}

.head {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.pick {
  display: flex;
  padding: 0.15rem 0 0.15rem 0.1rem;
  cursor: pointer;

  input {
    width: 18px;
    height: 18px;
    accent-color: $NICOLE-PURPLE;
    cursor: pointer;
  }
}

.who {
  flex: 1;
  min-width: 0;
}

.name {
  display: block;
  overflow: hidden;
  color: $ink;
  font-size: 1rem;
  font-weight: 700;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover { color: $NICOLE-PURPLE; text-decoration: underline; }
}

.sub {
  margin: 0.1rem 0 0;
  color: $muted;
  font-size: 0.76rem;
}

.total {
  color: $ink;
  font-size: 1.02rem;
  font-variant-numeric: tabular-nums;
}

.status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.22rem 0.6rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;

  &.t-warn { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  &.t-info { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  &.t-ok { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
  &.t-muted { background: #f4f2f6; color: #5f5868; border-color: $line; }
}

.age {
  color: $muted;
  font-size: 0.76rem;

  &.late { color: #b91c1c; font-weight: 700; }
}

.log {
  display: flex;
  gap: 0.45rem;
  margin: 0;
  padding: 0.5rem 0.6rem;
  border-radius: 10px;
  background: #f7f4f9;
  color: #4b4453;
  font-size: 0.8rem;
  line-height: 1.4;

  i { margin-top: 0.2rem; color: $muted; }
  em { display: block; color: $ink; font-style: normal; font-weight: 600; }
}

.products {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: #4b4453;
  font-size: 0.84rem;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.meta {
  margin: 0;
  color: $muted;
  font-size: 0.78rem;
}

.reach {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;

  a {
    padding: 0.2rem 0;
    color: $NICOLE-PURPLE;
    font-size: 0.82rem;
    font-weight: 600;
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }
}

.footer {
  margin-top: auto;
  padding-top: 0.25rem;
}
</style>
