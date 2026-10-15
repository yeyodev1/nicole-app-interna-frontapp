<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import OrderService from '@/services/order.service'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useBranches } from '@/composables/useBranches'
import { useSellers } from '@/composables/useSellers'
import { useDeliveryLine } from '@/composables/useDeliveryLine'
import { findSellerForCurrentUser } from '@/composables/useDefaultSeller'
import { isPrecioIvaIncluido } from '@/constants/pricing'
import type { Product, CartItem, OrderFormData, ClientLinkRequest } from '@/types/order'

import OrderProductSelector from './components/OrderProductSelector.vue'
import OrderCart from './components/OrderCart.vue'
import OrderPaymentSelector from './components/OrderPaymentSelector.vue'
import PayphoneLinkPanel from './components/PayphoneLinkPanel.vue'
import ClientLinkSuccessModal from './components/ClientLinkSuccessModal.vue'

/**
 * Venta con link (contrato v8). El asesor solo cobra: productos, total y pago.
 * Fecha, hora, dirección o isla de retiro y factura los llena el cliente en el
 * link que se genera al guardar.
 */

const router = useRouter()
const { success, error: showError, info } = useToast()
const dialog = useDialog()
const { branchNames, load: loadBranches } = useBranches()
const { activeSellers, load: loadSellers } = useSellers()

const isSubmitting = ref(false)
const isCourtesyMode = ref(false)
const payphoneUrl = ref('')

const plannedType = ref<'delivery' | 'retiro'>('delivery')
const estimatedDeliveryValue = ref<number | null>(null)
const customerEmail = ref('')

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })

const emptyForm = (): OrderFormData => ({
  customerName: '',
  customerPhone: '',
  deliveryDate: '',
  deliveryTime: '',
  deliveryType: 'delivery',
  branch: '',
  deliveryAddress: '',
  googleMapsLink: '',
  invoiceNeeded: false,
  comments: '',
  responsible: 'Web',
  sellerIdentification: '',
  sellerName: '',
  salesChannel: 'Venta con link',
  paymentMethod: 'Por confirmar',
  invoiceData: { ruc: '', businessName: '', email: '', address: '' },
  totalValue: 0,
  // En la venta con link se cobra al momento: el cobro arranca abierto.
  registerPaymentNow: true,
  isCredit: false,
  settledInIsland: false,
  settledIslandName: '',
  paymentDetails: {
    forma_cobro: 'TRA',
    monto: 0,
    fecha: today(),
    numero_comprobante: '',
    numero_tarjeta: '',
    cuenta_bancaria_id: '',
    tipo_ping: 'D'
  },
  globalDiscountPercentage: 0,
  isGlobalCourtesy: false,
  skipProduction: false,
  exitPoint: ''
})

const formData = reactive<OrderFormData>(emptyForm())
const cart = ref<CartItem[]>([])

const activeCartSource = computed<'nicole' | 'sucree' | null>(() => {
  const first = cart.value[0]
  if (!first) return null
  return first.source || 'nicole'
})

// --- Envío: el valor estimado ES la línea Delivery del carrito ---
const isDelivery = computed(() => plannedType.value === 'delivery')
useDeliveryLine({
  cart,
  value: estimatedDeliveryValue,
  enabled: isDelivery,
  source: activeCartSource,
  onError: (msg) => showError(msg)
})

// --- Total (misma fórmula que el pedido manual y el backend) ---
watch([cart, () => formData.globalDiscountPercentage, () => formData.isGlobalCourtesy], ([items, discount, courtesy]) => {
  if (courtesy) {
    formData.totalValue = 0
    return
  }
  let subtotal = 0
  let iva = 0
  for (const item of items) {
    let itemDiscount = item.isCourtesy ? 100 : 0
    if (discount && discount > 0 && itemDiscount < 100) itemDiscount = discount
    const line = item.price * item.quantity * ((100 - itemDiscount) / 100)
    subtotal += line
    if (!isPrecioIvaIncluido(item)) iva += line * 0.15
  }
  formData.totalValue = Number((subtotal + iva).toFixed(2))
}, { deep: true })

watch(() => formData.isGlobalCourtesy, (v) => { isCourtesyMode.value = !!v })
watch(isCourtesyMode, (v) => { if (formData.isGlobalCourtesy !== v) formData.isGlobalCourtesy = v })

// --- Vendedor: por defecto el usuario logueado (editable) ---
const sellersForSource = computed(() => {
  if (!activeCartSource.value) return activeSellers.value
  return activeSellers.value.filter(s => s.contificoSource === activeCartSource.value)
})
const sellerTouched = ref(false)

const applyDefaultSeller = () => {
  if (sellerTouched.value) return
  const current = formData.sellerIdentification
  if (current && sellersForSource.value.some(s => s.identification === current)) return
  const seller = findSellerForCurrentUser(sellersForSource.value)
  formData.sellerIdentification = seller?.identification || ''
  formData.sellerName = seller?.name || ''
}
watch(sellersForSource, applyDefaultSeller)

const onSellerChange = (e: Event) => {
  sellerTouched.value = true
  const identification = (e.target as HTMLSelectElement).value
  const seller = sellersForSource.value.find(s => s.identification === identification)
  formData.sellerIdentification = seller?.identification || ''
  formData.sellerName = seller?.name || ''
}

// --- Carrito ---
const addToCart = (product: Product) => {
  const existing = cart.value.find(item => item.contifico_id === product.id)
  const price = isCourtesyMode.value ? 0 : parseFloat(product.pvp1 || '0')
  if (existing) {
    if (product.pvp_manual) existing.price = price
    else existing.quantity++
    return
  }
  cart.value.push({
    id: product.id,
    contifico_id: product.id,
    name: product.nombre,
    price,
    quantity: 1,
    isCourtesy: isCourtesyMode.value,
    source: product.source
  })
}
const removeFromCart = (index: number) => { cart.value.splice(index, 1) }
const updateQuantity = (index: number, change: number) => {
  const item = cart.value[index]
  if (!item) return
  item.quantity += change
  if (item.quantity < 1) removeFromCart(index)
}
const toggleItemCourtesy = (index: number) => {
  const item = cart.value[index]
  if (item) item.isCourtesy = !item.isCourtesy
}

// --- Payphone ---
const onPayphoneGenerated = (url: string) => {
  payphoneUrl.value = url
  formData.registerPaymentNow = true
  formData.isCredit = false
  formData.settledInIsland = false
  if (formData.paymentDetails) {
    formData.paymentDetails.forma_cobro = 'TC'
    formData.paymentDetails.tipo_ping = 'D'
  }
}

const isPayphonePayment = computed(() => !!payphoneUrl.value && formData.paymentDetails?.forma_cobro === 'TC')

const paymentMethodLabel = computed(() => {
  if (formData.isGlobalCourtesy) return 'Cortesía'
  if (formData.isCredit) return 'Crédito'
  if (formData.settledInIsland) return `Isla: ${formData.settledIslandName}`
  if (!formData.registerPaymentNow) return 'Por confirmar'
  const forma = formData.paymentDetails?.forma_cobro
  if (forma === 'TRA') return 'Transferencia'
  if (forma === 'TC') return isPayphonePayment.value ? 'Payphone' : 'Tarjeta'
  if (forma === 'CR') return 'Crédito'
  return 'Por confirmar'
})

// --- Validación y envío ---
const phoneDigits = computed(() => formData.customerPhone.replace(/\D/g, ''))

const validate = (): string | null => {
  if (cart.value.length === 0) return 'Agrega al menos un producto.'
  if (!cart.value.some(i => !i.name.toLowerCase().includes('delivery'))) return 'El pedido solo tiene envío: agrega los productos.'
  if (!formData.customerName.trim()) return 'Escribe el nombre del cliente.'
  if (phoneDigits.value.length < 9) return 'Escribe el WhatsApp del cliente: ahí le llega el link.'
  if (customerEmail.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.value.trim())) return 'El correo no es válido.'

  const hasPaymentChoice = formData.isGlobalCourtesy || formData.isCredit || formData.settledInIsland || formData.registerPaymentNow
  if (!hasPaymentChoice) return 'Registra el cobro (o marca crédito, isla o cortesía).'
  if (formData.registerPaymentNow && !formData.isGlobalCourtesy && !formData.isCredit && !formData.settledInIsland) {
    const forma = formData.paymentDetails?.forma_cobro
    if ((forma === 'TRA' || forma === 'TC') && !formData.paymentDetails?.numero_comprobante?.trim()) {
      return forma === 'TRA'
        ? 'Escribe el número de la transferencia.'
        : 'Escribe el número de transacción (Payphone) o de lote/autorización.'
    }
    if (!(Number(formData.paymentDetails?.monto) > 0)) return 'El monto del cobro debe ser mayor a 0.'
  }
  if (formData.settledInIsland && !formData.settledIslandName) return 'Elige la isla donde se cobró.'
  return null
}

const showSuccess = ref(false)
const createdOrderId = ref<string | null>(null)
const clientLinkUrl = ref('')
const clientWhatsappMessage = ref('')
const createdPhone = ref('')

const submit = async () => {
  const problem = validate()
  if (problem) {
    showError(problem)
    return
  }

  const envio = Number(estimatedDeliveryValue.value || 0)
  if (isDelivery.value && !(envio > 0)) {
    const ok = await dialog.confirm('No pusiste valor de envío. ¿El envío va gratis para este cliente?', {
      title: 'Envío en $0',
      confirmLabel: 'Sí, envío gratis',
      cancelLabel: 'Poner envío',
      variant: 'warning'
    })
    if (!ok) return
  }

  const typeLine = isDelivery.value
    ? `Entrega a domicilio · envío estimado $${envio.toFixed(2)}`
    : 'Retiro en isla (el cliente elige cuál)'
  const ok = await dialog.confirm(
    `Cliente: ${String(formData.customerName).replace(/[<>&]/g, '')}\nTotal cobrado: $${(formData.totalValue || 0).toFixed(2)} · ${paymentMethodLabel.value}\n${typeLine}\n\nSe generará el link para que el cliente gestione su entrega.`,
    { title: 'Confirmar venta con link', confirmLabel: 'Generar link', cancelLabel: 'Revisar' }
  )
  if (!ok) return

  isSubmitting.value = true
  try {
    const clientLink: ClientLinkRequest = {
      plannedType: plannedType.value,
      estimatedDeliveryValue: isDelivery.value ? Number(envio.toFixed(2)) : 0,
      ...(customerEmail.value.trim() ? { customerEmail: customerEmail.value.trim() } : {})
    }

    const registersPayment = formData.registerPaymentNow && !formData.isCredit && !formData.settledInIsland && !formData.isGlobalCourtesy
    const payload: any = {
      ...formData,
      customerName: formData.customerName.trim(),
      customerPhone: formData.customerPhone.trim(),
      deliveryType: plannedType.value,
      deliveryValue: isDelivery.value ? Number(envio.toFixed(2)) : 0,
      branch: isDelivery.value ? 'Centro de Producción' : '',
      paymentMethod: paymentMethodLabel.value,
      clientLink,
      products: cart.value.map(item => ({
        contifico_id: item.contifico_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        isCourtesy: item.isCourtesy || false,
        source: item.source
      }))
    }
    delete payload.deliveryDate
    delete payload.deliveryTime
    delete payload.deliveryAddress
    delete payload.googleMapsLink

    if (formData.isCredit) {
      payload.registerPaymentNow = true
      payload.paymentDetails = {
        ...formData.paymentDetails,
        forma_cobro: 'CR',
        monto: formData.totalValue,
        fecha: today()
      }
    } else if (!registersPayment) {
      // Sin cobro registrado: que no viaje un monto viejo del formulario.
      delete payload.paymentDetails
    }

    const response: any = await OrderService.createOrder(payload)
    createdOrderId.value = response.order?._id || null
    clientLinkUrl.value = response.clientLinkUrl || ''
    clientWhatsappMessage.value = response.clientWhatsappMessage || ''
    createdPhone.value = formData.customerPhone
    if (!clientLinkUrl.value) {
      info('El pedido se guardó, pero el servidor no devolvió el link. Revísalo en el detalle del pedido.')
    }
    success('Venta registrada')
    showSuccess.value = true
    reset()
  } catch (e: any) {
    showError(e?.response?.data?.message || e?.message || 'No se pudo guardar la venta')
  } finally {
    isSubmitting.value = false
  }
}

const reset = () => {
  Object.assign(formData, emptyForm())
  cart.value = []
  isCourtesyMode.value = false
  payphoneUrl.value = ''
  estimatedDeliveryValue.value = null
  customerEmail.value = ''
  plannedType.value = 'delivery'
  sellerTouched.value = false
  applyDefaultSeller()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const goToOrder = () => {
  showSuccess.value = false
  if (createdOrderId.value) router.push({ name: 'order-detail', params: { id: createdOrderId.value } })
}

onMounted(async () => {
  loadBranches()
  await loadSellers()
  applyDefaultSeller()
})
</script>

<template>
  <div class="link-page">
    <header class="container page-header">
      <div class="header-content">
        <router-link to="/orders" class="back-link">← Pedidos</router-link>
        <div>
          <h1>Venta con link</h1>
          <p class="subtitle">
            Tú cobras. El cliente elige fecha, hora, dirección o isla de retiro y su factura desde el link.
          </p>
        </div>
        <router-link :to="{ name: 'create-order' }" class="manual-link">
          <i class="fa-solid fa-pen-to-square"></i> Pedido manual
        </router-link>
      </div>
    </header>

    <main class="container main-content">
      <section class="left-column">
        <div class="mode-toggle-container">
          <button
            class="btn-courtesy-toggle"
            :class="{ active: isCourtesyMode }"
            title="Afecta solo a productos que agregues ahora"
            @click="isCourtesyMode = !isCourtesyMode"
          >
            <i class="fa-solid fa-gift"></i>
            {{ isCourtesyMode ? 'Modo Cortesía (Próximos Items)' : 'Activar Cortesía Items' }}
          </button>
        </div>
        <OrderProductSelector :active-cart-source="activeCartSource" @add-to-cart="addToCart" />
      </section>

      <section class="order-form-section">
        <!-- 1. Cliente -->
        <div class="card">
          <div class="step-title"><span class="step">1</span> Cliente</div>
          <div class="grid">
            <div class="form-group">
              <label class="required-label" for="cl-name">Nombre</label>
              <input id="cl-name" v-model="formData.customerName" autocomplete="off" placeholder="Nombre y apellido" />
            </div>
            <div class="form-group">
              <label class="required-label" for="cl-phone">WhatsApp</label>
              <input id="cl-phone" v-model="formData.customerPhone" inputmode="tel" placeholder="09…" />
            </div>
            <div class="form-group full">
              <label for="cl-email">Correo <span class="optional">(opcional, para recordatorios y la factura)</span></label>
              <input id="cl-email" v-model="customerEmail" type="email" placeholder="cliente@correo.com" />
            </div>
          </div>
        </div>

        <!-- 2. Entrega -->
        <div class="card">
          <div class="step-title"><span class="step">2</span> ¿Cómo lo recibe?</div>
          <div class="type-toggle" role="radiogroup" aria-label="Tipo de entrega">
            <button
              type="button"
              role="radio"
              :aria-checked="plannedType === 'delivery'"
              :class="{ active: plannedType === 'delivery' }"
              @click="plannedType = 'delivery'"
            >
              <i class="fa-solid fa-truck-fast"></i>
              <span>Entrega a domicilio</span>
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="plannedType === 'retiro'"
              :class="{ active: plannedType === 'retiro' }"
              @click="plannedType = 'retiro'"
            >
              <i class="fa-solid fa-store"></i>
              <span>Retiro en isla</span>
            </button>
          </div>

          <div v-if="isDelivery" class="form-group envio">
            <label for="cl-envio">Envío estimado ($)</label>
            <input
              id="cl-envio"
              v-model.number="estimatedDeliveryValue"
              type="number"
              min="0"
              step="0.25"
              inputmode="decimal"
              placeholder="Ej: 4.50"
            />
            <small class="hint">
              Se agrega solo al carrito como "Delivery" (IVA incluido). Si el km real sale distinto, la diferencia la asume Nicole.
            </small>
          </div>
          <p v-else class="hint retiro-hint">
            <i class="fa-solid fa-circle-info"></i>
            El cliente elige la isla (Mall del Sol, San Marino…) en el link. No se retira en el Centro de Producción.
          </p>
        </div>

        <!-- 3. Cobro -->
        <div class="card">
          <div class="step-title"><span class="step">3</span> Cobro</div>

          <div class="form-group">
            <label for="cl-seller">Vendedor a cargo</label>
            <select id="cl-seller" :value="formData.sellerIdentification || ''" @change="onSellerChange">
              <option value="">Sin vendedor asignado</option>
              <option v-for="seller in sellersForSource" :key="seller._id" :value="seller.identification">
                {{ seller.name }}
              </option>
            </select>
            <small class="hint">Sale en la factura de Contífico (comisiones). Se pone solo con tu usuario.</small>
          </div>

          <PayphoneLinkPanel
            :cart="cart"
            :total-value="formData.totalValue || 0"
            :global-discount-percentage="formData.globalDiscountPercentage"
            :is-global-courtesy="formData.isGlobalCourtesy"
            :customer-name="formData.customerName"
            :customer-phone="formData.customerPhone"
            @generated="onPayphoneGenerated"
          />
          <p v-if="isPayphonePayment" class="hint payphone-hint">
            <i class="fa-solid fa-circle-info"></i>
            Cobro con Payphone: escribe el <strong>número de transacción</strong> en "Número de Lote / Autorización".
          </p>

          <OrderPaymentSelector v-model="formData" :branches="branchNames" />

          <div class="form-group">
            <label for="cl-notes">Nota interna <span class="optional">(no la ve el cliente)</span></label>
            <textarea id="cl-notes" v-model="formData.comments" rows="2" placeholder="Detalles para producción o el equipo…"></textarea>
          </div>
        </div>

        <OrderCart
          :cart="cart"
          :is-submitting="isSubmitting"
          :has-rider="true"
          :global-discount-percentage="formData.globalDiscountPercentage"
          :is-global-courtesy="formData.isGlobalCourtesy"
          submit-label="Guardar y generar link"
          @remove="removeFromCart"
          @update-quantity="updateQuantity"
          @toggle-courtesy="toggleItemCourtesy"
          @submit="submit"
        />
      </section>
    </main>

    <ClientLinkSuccessModal
      :is-open="showSuccess"
      :url="clientLinkUrl"
      :whatsapp-message="clientWhatsappMessage"
      :customer-phone="createdPhone"
      :order-id="createdOrderId"
      @close="showSuccess = false"
      @go-to-order="goToOrder"
    />
  </div>
</template>

<style lang="scss" scoped>
.link-page {
  background-color: #f8fafc;
  min-height: 100vh;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;

  @media (max-width: 900px) {
    padding: 0 1rem;
  }
}

.page-header {
  padding: 2rem 0 1rem;

  .header-content {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -1px;
  }

  .subtitle {
    margin: 0.25rem 0 0;
    color: #64748b;
  }
}

.back-link {
  color: #64748b;
  text-decoration: none;
  font-weight: 600;
}

.manual-link {
  margin-left: auto;
  color: #64748b;
  text-decoration: none;
  font-size: 0.9rem;
  border: 1px solid #e2e8f0;
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  background: white;
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 460px;
  gap: 2.5rem;
  padding-bottom: 4rem;
  align-items: start;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr 400px;
    gap: 1.5rem;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.mode-toggle-container {
  margin-bottom: 1.5rem;
  background: white;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid $border-light;
}

.btn-courtesy-toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  border: 2px solid $NICOLE-PURPLE;
  background-color: white;
  color: $NICOLE-PURPLE;
  font-weight: 700;
  cursor: pointer;

  &.active {
    background-color: $NICOLE-PURPLE;
    color: white;
  }
}

.card {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid $border-light;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  margin-bottom: 1.5rem;
}

.step-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  font-size: 1.15rem;
  color: $text-dark;
  margin-bottom: 1rem;
}

.step {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: $NICOLE-PURPLE;
  color: white;
  display: grid;
  place-items: center;
  font-size: 0.9rem;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  .full {
    grid-column: 1 / -1;
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;

  label {
    font-weight: 600;
    font-size: 0.9rem;
    color: #334155;
  }

  input,
  select,
  textarea {
    padding: 0.7rem 0.8rem;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.95rem;
    font-family: inherit;
    background: white;
    width: 100%;
    box-sizing: border-box;

    &:focus {
      outline: 2px solid rgba($NICOLE-PURPLE, 0.35);
      border-color: $NICOLE-PURPLE;
    }
  }
}

.required-label::after {
  content: ' *';
  color: #ef4444;
}

.optional {
  font-weight: 400;
  color: #94a3b8;
  font-size: 0.8rem;
}

.hint {
  color: #64748b;
  font-size: 0.8rem;
  line-height: 1.4;
}

.retiro-hint,
.payphone-hint {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0.5rem 0 0;

  i {
    color: $NICOLE-PURPLE;
    margin-top: 2px;
  }
}

.payphone-hint {
  margin: -0.25rem 0 0.75rem;
}

.type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;

  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 1rem 0.5rem;
    border: 2px solid $border-light;
    background: white;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 700;
    color: #475569;
    transition: all 0.15s ease;

    i {
      font-size: 1.3rem;
    }

    &.active {
      border-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.06);
      color: $NICOLE-PURPLE;
    }
  }
}

.envio {
  margin-bottom: 0;
}

.order-form-section {
  position: sticky;
  top: 2rem;
  height: max-content;
}
</style>
