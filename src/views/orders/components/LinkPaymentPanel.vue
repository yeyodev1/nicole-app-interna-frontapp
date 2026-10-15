<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { CartItem, OrderFormData } from '@/types/order'
import PayphoneLinkPanel from './PayphoneLinkPanel.vue'

/**
 * Cobro de la venta con link. Reemplaza al selector genérico (casillas + select)
 * por una elección de un toque y solo los campos que esa forma de pago necesita.
 *
 * Escribe en formData exactamente lo mismo que OrderPaymentSelector + PaymentFields
 * (registerPaymentNow, isCredit, settledInIsland, isGlobalCourtesy,
 * globalDiscountPercentage y paymentDetails), así el guardado no cambia.
 */
export type LinkPaymentMethod = 'TRA' | 'PAYPHONE' | 'TC' | 'CR' | 'ISLA' | 'CORTESIA'

const props = defineProps<{
  form: OrderFormData
  branches: readonly string[]
  cart: CartItem[]
  customerName?: string
  customerPhone?: string
}>()

const method = defineModel<LinkPaymentMethod>('method', { default: 'TRA' })

const METHODS: Array<{ value: LinkPaymentMethod; label: string; hint: string; icon: string }> = [
  { value: 'TRA', label: 'Transferencia', hint: 'Banco Guayaquil', icon: 'fa-building-columns' },
  { value: 'PAYPHONE', label: 'Payphone', hint: 'Link de pago', icon: 'fa-link' },
  { value: 'TC', label: 'Tarjeta', hint: 'Datafast / Medianet', icon: 'fa-credit-card' },
  { value: 'CR', label: 'Crédito', hint: 'Paga después', icon: 'fa-clock-rotate-left' },
  { value: 'ISLA', label: 'Pagado en isla', hint: 'Se cobró en tienda', icon: 'fa-store' },
  { value: 'CORTESIA', label: 'Cortesía', hint: 'Sin costo', icon: 'fa-gift' }
]

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })

const total = computed(() => Number(props.form.totalValue || 0))
const isPartial = ref(false)
const showDate = ref(false)
const showDiscount = ref((props.form.globalDiscountPercentage || 0) > 0 && !props.form.isGlobalCourtesy)
const referenceInput = ref<HTMLInputElement | null>(null)

const details = () => {
  if (!props.form.paymentDetails) {
    props.form.paymentDetails = { forma_cobro: 'TRA', monto: 0, fecha: today(), numero_comprobante: '', numero_tarjeta: '', cuenta_bancaria_id: '', tipo_ping: 'D' }
  }
  return props.form.paymentDetails
}

/**
 * Aplica la forma de pago con las mismas reglas que los toggles del pedido manual.
 * El foco va al número solo cuando el asesor elige; al cargar la página no salta.
 */
const apply = (value: LinkPaymentMethod, previous?: LinkPaymentMethod) => {
  const f = props.form
  const pd = details()
  const wasCourtesy = f.isGlobalCourtesy

  f.isCredit = value === 'CR'
  f.settledInIsland = value === 'ISLA'
  f.isGlobalCourtesy = value === 'CORTESIA'
  f.registerPaymentNow = value === 'TRA' || value === 'PAYPHONE' || value === 'TC'

  if (value === 'CORTESIA') {
    f.globalDiscountPercentage = 100
  } else if (wasCourtesy && f.globalDiscountPercentage === 100) {
    f.globalDiscountPercentage = 0
  }

  if (value === 'ISLA' && !f.settledIslandName) {
    f.settledIslandName = props.branches.find(b => !/centro|producc/i.test(b)) || props.branches[0] || 'San Marino'
  }

  if (value === 'TRA') pd.forma_cobro = 'TRA'
  if (value === 'PAYPHONE' || value === 'TC') {
    pd.forma_cobro = 'TC'
    pd.tipo_ping = pd.tipo_ping || 'D'
  }
  if (!pd.fecha) pd.fecha = today()

  if (f.registerPaymentNow && previous !== undefined) {
    nextTick(() => referenceInput.value?.focus())
  }
}

watch(method, apply, { immediate: true })

// Monto: el total, salvo abono parcial (igual que PaymentFields).
watch([isPartial, total], ([partial, value]) => {
  if (!partial) details().monto = Number(value.toFixed(2))
}, { immediate: true })

const referenceLabel = computed(() => {
  if (method.value === 'TRA') return 'Número de la transferencia'
  if (method.value === 'PAYPHONE') return 'Número de transacción de Payphone'
  return 'Lote / autorización del voucher'
})
const referencePlaceholder = computed(() => (method.value === 'TRA' ? 'Ej: 987654' : 'Ej: 123456'))

const islands = computed(() => props.branches.filter(b => !/centro|producc/i.test(b)))

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`
const prettyDate = computed(() => {
  const value = props.form.paymentDetails?.fecha || today()
  const [y, m, d] = value.split('-').map(Number)
  const label = new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  return value === today() ? `Hoy · ${label}` : label
})

const onPayphoneGenerated = () => {
  // El link ya está; ahora falta el número de transacción cuando el cliente pague.
  nextTick(() => referenceInput.value?.focus())
}

const toggleDiscount = () => {
  showDiscount.value = !showDiscount.value
  if (!showDiscount.value) props.form.globalDiscountPercentage = 0
}
</script>

<template>
  <div class="pay">
    <div class="methods" role="radiogroup" aria-label="Forma de pago">
      <button
        v-for="m in METHODS"
        :key="m.value"
        type="button"
        role="radio"
        class="method"
        :class="{ active: method === m.value }"
        :aria-checked="method === m.value"
        @click="method = m.value"
      >
        <i class="fa-solid" :class="m.icon" aria-hidden="true"></i>
        <span class="m-label">{{ m.label }}</span>
        <span class="m-hint">{{ m.hint }}</span>
      </button>
    </div>

    <!-- Payphone: primero el link, después el número -->
    <PayphoneLinkPanel
      v-if="method === 'PAYPHONE'"
      :cart="cart"
      :total-value="total"
      :global-discount-percentage="form.globalDiscountPercentage"
      :is-global-courtesy="form.isGlobalCourtesy"
      :customer-name="customerName"
      :customer-phone="customerPhone"
      @generated="onPayphoneGenerated"
    />

    <!-- Transferencia, Payphone y tarjeta: número del pago -->
    <div v-if="form.registerPaymentNow && form.paymentDetails" class="detail">
      <div class="ref">
        <label for="pay-ref">{{ referenceLabel }}</label>
        <input
          id="pay-ref"
          ref="referenceInput"
          v-model="form.paymentDetails.numero_comprobante"
          class="ref-input"
          autocomplete="off"
          :placeholder="referencePlaceholder"
        />
        <small v-if="method === 'TRA'" class="note"><i class="fa-solid fa-building-columns"></i> Se registra en Banco Guayaquil.</small>
        <small v-if="method === 'PAYPHONE'" class="note"><i class="fa-solid fa-circle-info"></i> Lo ves en Payphone Business cuando el cliente paga.</small>
      </div>

      <div v-if="method === 'TC'" class="card-row">
        <div class="mini">
          <label for="pay-last4">Últimos 4 de la tarjeta</label>
          <input
            id="pay-last4"
            v-model="form.paymentDetails.numero_tarjeta"
            inputmode="numeric"
            maxlength="4"
            placeholder="4242"
          />
        </div>
        <div class="mini">
          <span class="lbl">Procesador</span>
          <div class="chips">
            <button type="button" :class="{ on: form.paymentDetails.tipo_ping === 'D' }" @click="form.paymentDetails!.tipo_ping = 'D'">Datafast</button>
            <button type="button" :class="{ on: form.paymentDetails.tipo_ping === 'M' }" @click="form.paymentDetails!.tipo_ping = 'M'">Medianet</button>
          </div>
        </div>
      </div>

      <dl class="facts">
        <div>
          <dt>Monto</dt>
          <dd>
            <template v-if="!isPartial">{{ money(total) }} <small>(el total)</small></template>
            <span v-else class="partial">
              <span>$</span>
              <input v-model.number="form.paymentDetails.monto" type="number" min="0" :max="total" step="0.01" aria-label="Monto del abono" />
              <small>de {{ money(total) }}</small>
            </span>
          </dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>
            <template v-if="!showDate">
              {{ prettyDate }}
              <button type="button" class="link" @click="showDate = true">cambiar</button>
            </template>
            <input v-else v-model="form.paymentDetails.fecha" type="date" aria-label="Fecha del cobro" class="date" />
          </dd>
        </div>
      </dl>

      <button type="button" class="switch" role="switch" :aria-checked="isPartial" @click="isPartial = !isPartial">
        <span class="track"><span class="thumb"></span></span>
        Es un abono parcial
      </button>
    </div>

    <!-- Isla -->
    <div v-if="method === 'ISLA'" class="detail">
      <span class="lbl">¿En qué isla se cobró?</span>
      <div class="chips">
        <button
          v-for="b in islands"
          :key="b"
          type="button"
          :class="{ on: form.settledIslandName === b }"
          @click="form.settledIslandName = b"
        >
          {{ b }}
        </button>
      </div>
      <small class="note"><i class="fa-solid fa-circle-info"></i> La factura sale en la isla; aquí no se vuelve a facturar.</small>
    </div>

    <p v-if="method === 'CR'" class="callout warn">
      <i class="fa-solid fa-triangle-exclamation"></i>
      Queda como venta a crédito por <strong>{{ money(total) }}</strong>. El saldo queda pendiente de cobro.
    </p>
    <p v-if="method === 'CORTESIA'" class="callout gift">
      <i class="fa-solid fa-gift"></i>
      Todo el pedido va de regalo: total $0.00 y sin cobro.
    </p>

    <!-- Descuento -->
    <div v-if="method !== 'CORTESIA'" class="discount">
      <button type="button" class="link" @click="toggleDiscount">
        <i class="fa-solid fa-tag"></i> {{ showDiscount ? 'Quitar descuento' : 'Aplicar descuento' }}
      </button>
      <div v-if="showDiscount" class="discount-field">
        <input
          v-model.number="form.globalDiscountPercentage"
          type="number"
          min="0"
          max="99"
          placeholder="10"
          aria-label="Porcentaje de descuento"
        />
        <span>% a todo el pedido</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$ink: #1e293b;
$muted: #64748b;
$line: #e7e2ea;

.pay {
  button {
    font-family: inherit;
  }

  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.methods {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;

  @media (max-width: 560px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.method {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.8rem 0.9rem;
  border: 2px solid $line;
  background: white;
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  min-width: 0;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;

  i {
    font-size: 1.1rem;
    color: $muted;
    margin-bottom: 0.25rem;
  }

  .m-label {
    font-weight: 700;
    color: $ink;
    font-size: 0.92rem;
  }

  .m-hint {
    font-size: 0.75rem;
    color: $muted;
  }

  &:hover {
    border-color: rgba($NICOLE-PURPLE, 0.4);
  }

  &:focus-visible {
    outline: 3px solid rgba($NICOLE-PURPLE, 0.25);
    outline-offset: 2px;
  }

  &.active {
    border-color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.06);

    i,
    .m-label {
      color: $NICOLE-PURPLE;
    }
  }
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  background: #fbfafc;
  border: 1px solid $line;
  border-radius: 14px;
  padding: 1rem;
}

.ref {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  label {
    font-weight: 700;
    color: $ink;
  }
}

.ref-input {
  font-size: 1.15rem !important;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 0.8rem 0.95rem !important;
  width: 100%;
}

.note {
  color: $muted;
  font-size: 0.8rem;
  display: flex;
  gap: 0.4rem;
  align-items: center;

  i {
    color: $NICOLE-PURPLE;
  }
}

.card-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.mini {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;

  label,
  .lbl {
    font-weight: 600;
    font-size: 0.85rem;
    color: #334155;
  }

  input {
    width: 100%;
  }
}

.lbl {
  font-weight: 600;
  font-size: 0.9rem;
  color: #334155;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;

  button {
    border: 1px solid $line;
    background: white;
    border-radius: 999px;
    padding: 0.5rem 0.9rem;
    font-weight: 600;
    font-size: 0.85rem;
    color: #334155;
    cursor: pointer;

    &.on {
      background: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
      color: white;
    }
  }
}

.facts {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }

  div {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  dt {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: $muted;
    font-weight: 700;
  }

  dd {
    margin: 0;
    font-weight: 700;
    color: $ink;
    font-variant-numeric: tabular-nums;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;

    small {
      color: $muted;
      font-weight: 500;
    }
  }
}

.partial {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;

  input {
    width: 100px;
  }
}

.date {
  width: 100%;
  max-width: 220px;
}

.link {
  border: none;
  background: none;
  padding: 0;
  color: $NICOLE-PURPLE;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
}

.switch {
  border: none;
  background: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  width: max-content;

  .track {
    width: 40px;
    height: 22px;
    border-radius: 999px;
    background: #d9d3dd;
    position: relative;
    transition: background 0.15s ease;
  }

  .thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.15s ease;
  }

  &[aria-checked='true'] .track {
    background: $NICOLE-PURPLE;
  }

  &[aria-checked='true'] .thumb {
    transform: translateX(18px);
  }

  &:focus-visible .track {
    outline: 3px solid rgba($NICOLE-PURPLE, 0.25);
    outline-offset: 2px;
  }
}

.callout {
  margin: 0;
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  font-size: 0.9rem;

  i {
    margin-top: 3px;
  }

  &.warn {
    background: #fffbeb;
    color: #92400e;
  }

  &.gift {
    background: #fdf2f8;
    color: #9d174d;
  }
}

.discount {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.discount-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: $muted;
  font-size: 0.9rem;

  input {
    width: 90px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .method,
  .switch .track,
  .switch .thumb {
    transition: none;
  }
}
</style>
