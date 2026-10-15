<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { parseECTDate } from '@/utils/dateUtils'
import { clientLinkMessage, clientLinkState, copyText } from '@/utils/clientLink'
import { useToast } from '@/composables/useToast'

/**
 * Tarjeta de la lista de pedidos. Arriba quién y qué tipo; luego un estado
 * principal + factura + pago; una línea de fecha y una de lugar; total; y una
 * acción principal con el resto en el menú "⋯".
 */
const props = defineProps<{
  order: any
  isSelected: boolean
  batchMode: boolean
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'toggle-select'): void
  (e: 'copy-summary'): void
  (e: 'payment'): void
  (e: 'invoice-edit'): void
  (e: 'retry-invoice'): void
  (e: 'settle'): void
  (e: 'view-detail'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'return'): void
}>()

const { success, error: showError } = useToast()

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const o = computed(() => props.order)
const linkState = computed(() => clientLinkState(o.value))
const isDelivery = computed(() => o.value.deliveryType === 'delivery')
const isVoided = computed(() => !!o.value.voidedAt || o.value.productionStage === 'VOID')
const isWeb = computed(() => !!o.value.webOrder?.externalId || o.value.salesChannel === 'Tienda Online')

/** "Vie 16 oct · 11h00" en una sola línea. */
const whenLabel = computed(() => {
  if (!o.value.deliveryDate) {
    return linkState.value ? 'Fecha: la elige el cliente' : 'Sin fecha'
  }
  const d = parseECTDate(o.value.deliveryDate)
  const date = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
  const time = o.value.deliveryTime && o.value.deliveryTime.includes(':') ? o.value.deliveryTime.replace(':', 'h') : ''
  return time ? `${date} · ${time}` : date
})

const placeLabel = computed(() => {
  if (o.value.skipProduction) return `Retiro directo · ${o.value.exitPoint || 'Tienda'}`
  if (isDelivery.value) {
    if (o.value.deliveryAddress) return o.value.deliveryAddress
    return linkState.value === 'PENDING' || linkState.value === 'EXPIRED' ? 'Dirección: la pone el cliente' : 'Sin dirección'
  }
  if (o.value.branch) return `Retira en ${o.value.branch}`
  return linkState.value ? 'Isla: la elige el cliente' : 'Sin sucursal'
})

const createdLabel = computed(() => {
  if (!o.value.createdAt) return ''
  const d = new Date(o.value.createdAt)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

/** Un solo estado principal, el más útil para operar el pedido. */
const status = computed<{ label: string; tone: string; icon: string }>(() => {
  if (isVoided.value) return { label: 'Anulado', tone: 'muted', icon: 'fa-ban' }
  if (linkState.value === 'PENDING') return { label: 'Esperando al cliente', tone: 'brand', icon: 'fa-link' }
  if (linkState.value === 'EXPIRED') return { label: 'Link vencido', tone: 'danger', icon: 'fa-link-slash' }
  if (o.value.status === 'PENDIENTE_GESTION') return { label: 'Web por gestionar', tone: 'warn', icon: 'fa-bell' }
  switch (o.value.dispatchStatus) {
    case 'SENT': return { label: 'Enviado', tone: 'ok', icon: 'fa-truck' }
    case 'PARTIAL': return { label: 'Envío parcial', tone: 'warn', icon: 'fa-truck' }
    case 'RETURNED': return { label: 'Devuelto', tone: 'danger', icon: 'fa-reply' }
    case 'PROBLEM': return { label: 'Problema en envío', tone: 'danger', icon: 'fa-triangle-exclamation' }
  }
  if (o.value.skipProduction) return { label: 'Retiro directo', tone: 'info', icon: 'fa-store' }
  switch (o.value.productionStage) {
    case 'FINISHED': return { label: 'Listo', tone: 'ok', icon: 'fa-check' }
    case 'IN_PROCESS': return { label: 'En producción', tone: 'info', icon: 'fa-fire-burner' }
    case 'DELAYED': return { label: 'Atrasado', tone: 'danger', icon: 'fa-clock' }
    case 'AWAITING_CLIENT': return { label: 'Esperando al cliente', tone: 'brand', icon: 'fa-link' }
    default: return { label: 'Por producir', tone: 'neutral', icon: 'fa-hourglass-start' }
  }
})

const invoice = computed<{ label: string; tone: string }>(() => {
  if (o.value.settledInIsland) return { label: `Facturado en ${o.value.settledIslandName || 'isla'}`, tone: 'ok' }
  if (o.value.invoiceStatus === 'PROCESSED') return { label: 'Facturado', tone: 'ok' }
  if (o.value.invoiceStatus === 'ERROR') return { label: 'Error factura', tone: 'danger' }
  if (o.value.invoiceStatus === 'PENDING') return { label: 'Factura en cola', tone: 'neutral' }
  return { label: 'Sin factura', tone: 'muted' }
})

const paymentKey = computed(() => {
  if (o.value.settledInIsland) return 'paid'
  if (o.value.webOrder?.paymentStatus === 'PENDING_VERIFICATION') return 'verify'
  const paid = (o.value.payments || []).reduce((sum: number, p: any) => sum + (p.monto || 0), 0)
  const total = o.value.totalValue || 0
  if (paid >= total - 0.05) return 'paid'
  if (paid > 0) return 'partial'
  return 'pending'
})

const payment = computed(() => {
  switch (paymentKey.value) {
    case 'paid': return { label: 'Pagado', tone: 'ok' }
    case 'partial': return { label: 'Abono parcial', tone: 'warn' }
    case 'verify': return { label: 'Transferencia por verificar', tone: 'warn' }
    default: return { label: 'Pago pendiente', tone: 'danger' }
  }
})

// --- Acción principal ---
const linkPending = computed(() => linkState.value === 'PENDING' || linkState.value === 'EXPIRED')

const copyMessage = async () => {
  if (await copyText(clientLinkMessage(o.value))) success('Mensaje copiado: pégalo en el WhatsApp del cliente')
  else showError('No se pudo copiar. Ábrelo desde el detalle del pedido.')
}

// --- Menú "⋯" ---
const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)

const onDocClick = (e: MouseEvent) => {
  if (root.value && !root.value.contains(e.target as Node)) closeMenu()
}
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') closeMenu()
}
const openMenu = () => {
  menuOpen.value = true
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
}
const closeMenu = () => {
  menuOpen.value = false
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
}
const toggleMenu = () => (menuOpen.value ? closeMenu() : openMenu())
const run = (fn: () => void) => {
  closeMenu()
  fn()
}
onBeforeUnmount(closeMenu)

const showInvoiceEdit = computed(
  () => o.value.invoiceStatus !== 'PROCESSED' && paymentKey.value !== 'paid'
)
const canReturn = computed(() => ['SENT', 'PARTIAL', 'PROBLEM'].includes(o.value.dispatchStatus || ''))
</script>

<template>
  <article
    ref="root"
    class="order-card"
    :class="[`edge-${status.tone}`, { selected: isSelected, voided: isVoided, 'menu-open': menuOpen }]"
    @click="emit('click')"
  >
    <!-- Selección en lote -->
    <button
      v-if="batchMode"
      type="button"
      class="select-box"
      :class="{ on: isSelected }"
      :aria-pressed="isSelected"
      aria-label="Seleccionar pedido"
      @click.stop="emit('toggle-select')"
    >
      <i class="fa-solid fa-check"></i>
    </button>

    <!-- Quién -->
    <header class="head" :class="{ 'with-select': batchMode }">
      <div class="who">
        <h3 class="name" :title="order.customerName">{{ order.customerName }}</h3>
        <p class="sub">
          <span v-if="order.customerPhone"><i class="fa-brands fa-whatsapp"></i> {{ order.customerPhone }}</span>
          <span v-if="isWeb" class="web-tag" :title="order.webOrder?.code ? `Pedido web ${order.webOrder.code}` : 'Tienda online'">
            <i class="fa-solid fa-bag-shopping"></i> Web{{ order.webOrder?.code ? ` · ${order.webOrder.code}` : '' }}
          </span>
        </p>
      </div>
      <span class="type" :class="isDelivery ? 'delivery' : 'pickup'" :title="isDelivery ? 'Delivery' : 'Retiro'">
        <i class="fa-solid" :class="isDelivery ? 'fa-truck-fast' : 'fa-store'"></i>
        {{ isDelivery ? 'Delivery' : 'Retiro' }}
      </span>
    </header>

    <!-- Estados -->
    <div class="chips">
      <span class="chip strong" :class="`t-${status.tone}`"><i class="fa-solid" :class="status.icon"></i>{{ status.label }}</span>
      <span class="chip" :class="`t-${invoice.tone}`">{{ invoice.label }}</span>
      <span class="chip" :class="`t-${payment.tone}`">{{ payment.label }}</span>
    </div>

    <!-- Cuándo y dónde -->
    <dl class="facts">
      <div class="fact" :class="{ pending: !order.deliveryDate }">
        <dt><i class="fa-regular fa-calendar"></i><span class="sr">Entrega</span></dt>
        <dd>{{ whenLabel }}</dd>
      </div>
      <div class="fact">
        <dt><i class="fa-solid" :class="isDelivery ? 'fa-location-dot' : 'fa-store'"></i><span class="sr">Lugar</span></dt>
        <dd :title="placeLabel">{{ placeLabel }}</dd>
      </div>
      <div v-if="order.comments" class="fact note">
        <dt><i class="fa-regular fa-comment"></i><span class="sr">Nota</span></dt>
        <dd :title="order.comments">{{ order.comments }}</dd>
      </div>
    </dl>

    <!-- Total -->
    <div class="money">
      <div>
        <span class="money-label">Total</span>
        <strong class="money-value">${{ Number(order.totalValue || 0).toFixed(2) }}</strong>
      </div>
      <div class="meta">
        <span v-if="order.responsible" :title="`Responsable: ${order.responsible}`"><i class="fa-regular fa-user"></i> {{ order.responsible }}</span>
        <span v-if="createdLabel" title="Registrado"><i class="fa-regular fa-clock"></i> {{ createdLabel }}</span>
      </div>
    </div>

    <!-- Acciones -->
    <footer class="actions" @click.stop>
      <button v-if="order.invoiceStatus === 'ERROR'" type="button" class="primary danger" @click="emit('retry-invoice')">
        <i class="fa-solid fa-rotate-right"></i> Reintentar factura
      </button>
      <button v-else-if="linkPending" type="button" class="primary brand" @click="copyMessage">
        <i class="fa-regular fa-copy"></i> Copiar mensaje
      </button>
      <button v-else type="button" class="primary wa" @click="emit('copy-summary')">
        <i class="fa-brands fa-whatsapp"></i> Copiar pedido
      </button>

      <button
        type="button"
        class="quick"
        :class="{ ok: paymentKey === 'paid', warn: paymentKey === 'partial' }"
        title="Cobro"
        aria-label="Cobro"
        @click="emit('payment')"
      >
        <i class="fa-solid fa-dollar-sign"></i>
      </button>

      <div class="more">
        <button
          type="button"
          class="quick"
          :aria-expanded="menuOpen"
          aria-haspopup="menu"
          aria-label="Más acciones"
          title="Más acciones"
          @click="toggleMenu"
        >
          <i class="fa-solid fa-ellipsis"></i>
        </button>
        <Transition name="pop">
          <div v-if="menuOpen" class="menu" role="menu">
            <button type="button" role="menuitem" @click="run(() => emit('payment'))">
              <i class="fa-solid fa-dollar-sign"></i> Registrar cobro
            </button>
            <button v-if="showInvoiceEdit" type="button" role="menuitem" @click="run(() => emit('invoice-edit'))">
              <i class="fa-solid fa-file-invoice"></i> Datos de factura
            </button>
            <button v-if="!order.settledInIsland" type="button" role="menuitem" @click="run(() => emit('settle'))">
              <i class="fa-solid fa-store"></i> Facturado en isla
            </button>
            <button v-if="batchMode" type="button" role="menuitem" @click="run(() => emit('view-detail'))">
              <i class="fa-solid fa-eye"></i> Ver detalle
            </button>
            <button type="button" role="menuitem" @click="run(() => emit('edit'))">
              <i class="fa-solid fa-pen-to-square"></i> Editar
            </button>
            <button v-if="canReturn" type="button" role="menuitem" @click="run(() => emit('return'))">
              <i class="fa-solid fa-reply"></i> Registrar devolución
            </button>
            <div class="sep" role="separator"></div>
            <button type="button" role="menuitem" class="danger" @click="run(() => emit('delete'))">
              <i class="fa-solid fa-trash-can"></i> Eliminar
            </button>
          </div>
        </Transition>
      </div>
    </footer>
  </article>
</template>

<style lang="scss" scoped>
$ink: #1e1b24;
$muted: #6b6475;
$line: #ece7ef;

.order-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: white;
  border: 1px solid $line;
  border-radius: 16px;
  padding: 1.1rem 1.15rem 1rem;
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  min-width: 0;

  // Franja de estado a la izquierda
  &::before {
    content: '';
    position: absolute;
    left: -1px;
    top: 14px;
    bottom: 14px;
    width: 4px;
    border-radius: 0 4px 4px 0;
    background: transparent;
  }

  &.edge-brand::before { background: $NICOLE-PURPLE; }
  &.edge-danger::before { background: #dc2626; }
  &.edge-warn::before { background: #d97706; }
  &.edge-ok::before { background: #16a34a; }
  &.edge-info::before { background: #2563eb; }

  &:hover {
    border-color: rgba($NICOLE-PURPLE, 0.35);
    box-shadow: 0 8px 24px rgba(73, 15, 87, 0.08);
  }

  &.selected {
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.15);
  }

  &.voided {
    opacity: 0.6;
  }

  &.menu-open {
    z-index: 20;
  }
}

.select-box {
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 2px solid #cfc6d6;
  background: white;
  color: transparent;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
  cursor: pointer;
  z-index: 2;

  &.on {
    background: $NICOLE-PURPLE;
    border-color: $NICOLE-PURPLE;
    color: white;
  }
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;

  &.with-select {
    padding-right: 2rem;
  }
}

.who {
  min-width: 0;
}

.name {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 700;
  color: $ink;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub {
  margin: 0.15rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  font-size: 0.82rem;
  color: $muted;
  font-variant-numeric: tabular-nums;

  i {
    font-size: 0.8rem;
  }
}

.web-tag {
  color: #490f57;
  font-weight: 600;
}

.type {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  white-space: nowrap;

  &.delivery {
    background: #fff1f2;
    color: #be123c;
  }

  &.pickup {
    background: #eff6ff;
    color: #1d4ed8;
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.74rem;
  font-weight: 600;
  padding: 0.22rem 0.6rem;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;

  i {
    font-size: 0.7rem;
  }

  &.strong {
    font-weight: 800;
  }

  &.t-brand { background: rgba($NICOLE-PURPLE, 0.09); color: $NICOLE-PURPLE; border-color: rgba($NICOLE-PURPLE, 0.18); }
  &.t-ok { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
  &.t-warn { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  &.t-danger { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  &.t-info { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  &.t-neutral { background: #f4f2f6; color: #4b4453; border-color: $line; }
  &.t-muted { background: transparent; color: #8b8494; border-color: $line; }
}

.facts {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.fact {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  font-size: 0.9rem;
  color: $ink;

  dt {
    flex: none;
    width: 16px;
    text-align: center;
    color: #a39bab;
    font-size: 0.85rem;
  }

  dd {
    margin: 0;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &:first-child dd {
    font-weight: 700;
  }

  &.pending dd {
    color: $NICOLE-PURPLE;
    font-weight: 600;
  }

  &.note dd {
    color: $muted;
    font-size: 0.84rem;
  }
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.money {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed $line;
}

.money-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  color: #a39bab;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.money-value {
  font-size: 1.45rem;
  font-weight: 800;
  color: $NICOLE-PURPLE;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
  min-width: 0;
  font-size: 0.75rem;
  color: #8b8494;

  span {
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  cursor: default;
}

.primary {
  flex: 1;
  min-width: 0;
  height: 40px;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.88rem;
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  cursor: pointer;
  white-space: nowrap;
  transition: filter 0.15s ease, transform 0.1s ease;

  &:hover { filter: brightness(0.94); }
  &:active { transform: translateY(1px); }
  &:focus-visible { outline: 3px solid rgba($NICOLE-PURPLE, 0.35); outline-offset: 2px; }

  &.brand { background: $NICOLE-PURPLE; }
  &.wa { background: #1fae54; }
  &.danger { background: #dc2626; }
}

.quick {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid $line;
  background: white;
  color: $muted;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: $NICOLE-PURPLE;
    color: $NICOLE-PURPLE;
  }

  &:focus-visible { outline: 3px solid rgba($NICOLE-PURPLE, 0.3); outline-offset: 2px; }

  &.ok { color: #16a34a; border-color: #bbf7d0; background: #f0fdf4; }
  &.warn { color: #b45309; border-color: #fde68a; background: #fffbeb; }
}

.more {
  position: relative;
}

.menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  min-width: 210px;
  background: white;
  border: 1px solid $line;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(30, 27, 36, 0.16);
  padding: 0.35rem;
  display: flex;
  flex-direction: column;
  z-index: 30;

  button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    border: none;
    background: transparent;
    padding: 0.55rem 0.7rem;
    border-radius: 8px;
    font-size: 0.88rem;
    color: $ink;
    text-align: left;
    cursor: pointer;

    i {
      width: 16px;
      text-align: center;
      color: #a39bab;
    }

    &:hover,
    &:focus-visible {
      background: #f7f3f8;
      outline: none;

      i { color: $NICOLE-PURPLE; }
    }

    &.danger {
      color: #b91c1c;

      i { color: #dc2626; }

      &:hover { background: #fef2f2; }
    }
  }

  .sep {
    height: 1px;
    background: $line;
    margin: 0.25rem 0.3rem;
  }
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .order-card,
  .primary,
  .quick,
  .pop-enter-active,
  .pop-leave-active {
    transition: none;
  }
}
</style>
