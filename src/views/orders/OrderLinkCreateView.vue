<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import OrderService from '@/services/order.service'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useBranches } from '@/composables/useBranches'
import { useSellers } from '@/composables/useSellers'
import { useDeliveryLine, isDeliveryLine } from '@/composables/useDeliveryLine'
import { findSellerForCurrentUser } from '@/composables/useDefaultSeller'
import { isPrecioIvaIncluido } from '@/constants/pricing'
import type { Product, CartItem, OrderFormData, ClientLinkRequest } from '@/types/order'

import OrderProductSelector from './components/OrderProductSelector.vue'
import LinkPaymentPanel, { type LinkPaymentMethod } from './components/LinkPaymentPanel.vue'
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
const paymentMethod = ref<LinkPaymentMethod>('TRA')

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

// --- Cobro: la forma de pago la elige LinkPaymentPanel ---
const paymentMethodLabel = computed(() => {
  switch (paymentMethod.value) {
    case 'CORTESIA': return 'Cortesía'
    case 'CR': return 'Crédito'
    case 'ISLA': return `Isla: ${formData.settledIslandName}`
    case 'PAYPHONE': return 'Payphone'
    case 'TC': return 'Tarjeta'
    default: return 'Transferencia'
  }
})

// --- WhatsApp del cliente: con eso basta (el nombre lo pone el cliente en el link) ---
/** Celular de Ecuador en 10 dígitos (09XXXXXXXX). Acepta +593 / 593 al pegar. */
const normalizePhone = (raw: string) => {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('593')) digits = `0${digits.slice(3)}`
  if (digits.length === 9 && digits.startsWith('9')) digits = `0${digits}`
  return digits.slice(0, 10)
}
const phoneDisplay = computed({
  get: () => {
    const d = normalizePhone(formData.customerPhone)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
  },
  set: (value: string) => { formData.customerPhone = normalizePhone(value) }
})
const phoneValid = computed(() => /^09\d{8}$/.test(normalizePhone(formData.customerPhone)))
const phoneTouched = ref(false)

// --- Vendedor: desplegable propio ---
const sellerOpen = ref(false)
const pickSeller = (identification: string) => {
  sellerTouched.value = true
  const seller = sellersForSource.value.find(s => s.identification === identification)
  formData.sellerIdentification = seller?.identification || ''
  formData.sellerName = seller?.name || ''
  sellerOpen.value = false
}
const showNotes = ref(false)

// --- Validación y envío ---

// --- Resumen visible: precio final por línea (con IVA, como lo paga el cliente) ---
const lineTotal = (item: CartItem) => {
  const discount = item.isCourtesy ? 100 : formData.globalDiscountPercentage || 0
  const base = item.price * item.quantity * ((100 - discount) / 100)
  return isPrecioIvaIncluido(item) ? base : base * 1.15
}
const productLines = computed(() =>
  cart.value.map((item, index) => ({ item, index })).filter(({ item }) => !isDeliveryLine(item))
)
const productCount = computed(() => productLines.value.reduce((n, { item }) => n + item.quantity, 0))
const shippingTotal = computed(() =>
  formData.isGlobalCourtesy ? 0 : cart.value.filter(isDeliveryLine).reduce((sum, item) => sum + lineTotal(item), 0)
)
const productsTotal = computed(() => Math.max(0, (formData.totalValue || 0) - shippingTotal.value))
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`

/** El cobro está listo: hay forma de pago y, si se registra, su número. */
const paymentReady = computed(() => {
  if (formData.isGlobalCourtesy || formData.isCredit) return true
  if (formData.settledInIsland) return !!formData.settledIslandName
  if (!formData.registerPaymentNow) return false
  const forma = formData.paymentDetails?.forma_cobro
  if ((forma === 'TRA' || forma === 'TC') && !formData.paymentDetails?.numero_comprobante?.trim()) return false
  return Number(formData.paymentDetails?.monto) > 0
})

const steps = computed(() => [
  { n: 1, label: 'Productos', done: productLines.value.length > 0, detail: productLines.value.length ? `${productCount.value} en el pedido` : 'Busca y toca +' },
  {
    n: 2,
    label: isDelivery.value ? 'Entrega a domicilio' : 'Retiro en isla',
    done: true,
    detail: isDelivery.value
      ? Number(estimatedDeliveryValue.value) > 0 ? `Envío ${money(Number(estimatedDeliveryValue.value))}` : 'Sin envío (gratis)'
      : 'El cliente elige la isla'
  },
  {
    n: 3,
    label: 'Cliente',
    done: phoneValid.value,
    detail: phoneValid.value ? `WhatsApp ${phoneDisplay.value}` : 'Su WhatsApp'
  },
  { n: 4, label: 'Cobro', done: paymentReady.value, detail: paymentReady.value ? paymentMethodLabel.value : 'Falta el número de pago' }
])
const missing = computed(() => steps.value.filter(s => !s.done))
const canSubmit = computed(() => missing.value.length === 0 && !isSubmitting.value)
const stepDone = (n: number) => steps.value.find(s => s.n === n)?.done

const validate = (): string | null => {
  if (cart.value.length === 0) return 'Agrega al menos un producto.'
  if (!cart.value.some(i => !i.name.toLowerCase().includes('delivery'))) return 'El pedido solo tiene envío: agrega los productos.'
  if (!phoneValid.value) return 'Escribe el WhatsApp del cliente (09XXXXXXXX): ahí le llega el link.'
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
    `Cliente: ${String(formData.customerName.trim() || phoneDisplay.value).replace(/[<>&]/g, '')}\nTotal cobrado: $${(formData.totalValue || 0).toFixed(2)} · ${paymentMethodLabel.value}\n${typeLine}\n\nSe generará el link para que el cliente gestione su entrega.`,
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
      customerPhone: normalizePhone(formData.customerPhone),
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
  paymentMethod.value = 'TRA'
  phoneTouched.value = false
  showNotes.value = false
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
      <router-link to="/orders" class="back-link"><i class="fa-solid fa-arrow-left"></i> Pedidos</router-link>
      <div class="title-row">
        <div>
          <h1>Venta con link</h1>
          <p class="subtitle">Tú cobras aquí. El cliente pone su dirección, la fecha y su factura en el link.</p>
        </div>
        <router-link :to="{ name: 'create-order' }" class="manual-link">
          <i class="fa-solid fa-pen-to-square"></i> Pedido manual
        </router-link>
      </div>

      <ol class="how" aria-label="Cómo funciona">
        <li><span class="how-n">1</span><div><strong>Arma el pedido</strong><small>Productos y si es entrega o retiro</small></div></li>
        <li><span class="how-n">2</span><div><strong>Registra el cobro</strong><small>Transferencia, tarjeta o link de Payphone</small></div></li>
        <li><span class="how-n">3</span><div><strong>Manda el link</strong><small>El cliente elige dirección, fecha y factura</small></div></li>
      </ol>
    </header>

    <main class="container layout">
      <div class="steps">
        <!-- 1. Productos -->
        <section class="card" :class="{ done: stepDone(1) }" aria-labelledby="st-1">
          <div class="card-head">
            <span class="badge"><i v-if="stepDone(1)" class="fa-solid fa-check"></i><template v-else>1</template></span>
            <div class="card-title">
              <h2 id="st-1">¿Qué compró?</h2>
              <p>Busca el producto y toca <strong>+</strong>. El precio ya incluye IVA.</p>
            </div>
            <button
              type="button"
              class="chip-toggle"
              :class="{ on: isCourtesyMode }"
              :aria-pressed="isCourtesyMode"
              title="Los próximos productos que agregues van de regalo"
              @click="isCourtesyMode = !isCourtesyMode"
            >
              <i class="fa-solid fa-gift"></i> {{ isCourtesyMode ? 'Cortesía activa' : 'Cortesía' }}
            </button>
          </div>

          <div class="catalog">
            <OrderProductSelector compact hide-delivery :active-cart-source="activeCartSource" @add-to-cart="addToCart" />
          </div>

          <div class="picked">
            <h3>En el pedido <span v-if="productLines.length" class="count">{{ productCount }}</span></h3>
            <p v-if="!productLines.length" class="empty">Todavía no agregas productos.</p>
            <ul v-else class="lines">
              <li v-for="{ item, index } in productLines" :key="`${item.contifico_id}-${index}`" class="line">
                <div class="line-name">
                  <span>{{ item.name }}</span>
                  <small v-if="item.isCourtesy" class="gift"><i class="fa-solid fa-gift"></i> Cortesía</small>
                </div>
                <div class="qty" role="group" :aria-label="`Cantidad de ${item.name}`">
                  <button type="button" aria-label="Quitar uno" @click="updateQuantity(index, -1)"><i class="fa-solid fa-minus"></i></button>
                  <span>{{ item.quantity }}</span>
                  <button type="button" aria-label="Agregar uno" @click="updateQuantity(index, 1)"><i class="fa-solid fa-plus"></i></button>
                </div>
                <span class="line-total">{{ money(lineTotal(item)) }}</span>
                <div class="line-actions">
                  <button type="button" class="icon" :class="{ on: item.isCourtesy }" title="Marcar como cortesía" @click="toggleItemCourtesy(index)"><i class="fa-solid fa-gift"></i></button>
                  <button type="button" class="icon danger" title="Quitar del pedido" @click="removeFromCart(index)"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <!-- 2. Entrega -->
        <section class="card done" aria-labelledby="st-2">
          <div class="card-head">
            <span class="badge"><i class="fa-solid fa-check"></i></span>
            <div class="card-title">
              <h2 id="st-2">¿Cómo lo recibe?</h2>
              <p>La dirección exacta o la isla las elige el cliente en el link.</p>
            </div>
          </div>

          <div class="type-toggle" role="radiogroup" aria-label="Tipo de entrega">
            <button type="button" role="radio" :aria-checked="isDelivery" :class="{ active: isDelivery }" @click="plannedType = 'delivery'">
              <i class="fa-solid fa-truck-fast"></i>
              <strong>Entrega a domicilio</strong>
              <small>Sale del Centro de Producción</small>
            </button>
            <button type="button" role="radio" :aria-checked="!isDelivery" :class="{ active: !isDelivery }" @click="plannedType = 'retiro'">
              <i class="fa-solid fa-store"></i>
              <strong>Retiro en isla</strong>
              <small>Mall del Sol, San Marino…</small>
            </button>
          </div>

          <div v-if="isDelivery" class="field envio">
            <label for="cl-envio">Envío que cobraste</label>
            <div class="money-input">
              <span>$</span>
              <input id="cl-envio" v-model.number="estimatedDeliveryValue" type="number" min="0" step="0.25" inputmode="decimal" placeholder="4.50" />
            </div>
            <small class="hint">Es un estimado. Si el recorrido real cuesta distinto, la diferencia la asume Nicole.</small>
          </div>
        </section>

        <!-- 3. Cliente -->
        <section class="card" :class="{ done: stepDone(3) }" aria-labelledby="st-3">
          <div class="card-head">
            <span class="badge"><i v-if="stepDone(3)" class="fa-solid fa-check"></i><template v-else>3</template></span>
            <div class="card-title">
              <h2 id="st-3">WhatsApp del cliente</h2>
              <p>Con su número basta. Su nombre y quién recibe los pone el cliente en el link.</p>
            </div>
          </div>
          <div class="field phone-field" :class="{ invalid: phoneTouched && formData.customerPhone && !phoneValid }">
            <label for="cl-phone">WhatsApp <span class="req">*</span></label>
            <div class="phone-input">
              <span class="prefix"><i class="fa-brands fa-whatsapp"></i></span>
              <input
                id="cl-phone"
                v-model="phoneDisplay"
                inputmode="tel"
                autocomplete="off"
                placeholder="099 123 4567"
                @blur="phoneTouched = true"
              />
              <i v-if="phoneValid" class="fa-solid fa-circle-check ok-icon" aria-hidden="true"></i>
            </div>
            <small v-if="phoneTouched && formData.customerPhone && !phoneValid" class="error">Debe ser un celular de 10 dígitos que empiece con 09.</small>
          </div>
          <div class="grid">
            <div class="field">
              <label for="cl-name">Nombre <span class="opt">opcional · lo pone el cliente en el link</span></label>
              <input id="cl-name" v-model="formData.customerName" autocomplete="off" placeholder="Si ya lo sabes" />
            </div>
            <div class="field">
              <label for="cl-email">Correo <span class="opt">opcional · recordatorios y factura</span></label>
              <input id="cl-email" v-model="customerEmail" type="email" placeholder="cliente@correo.com" />
            </div>
          </div>
        </section>

        <!-- 4. Cobro -->
        <section class="card" :class="{ done: stepDone(4) }" aria-labelledby="st-4">
          <div class="card-head">
            <span class="badge"><i v-if="stepDone(4)" class="fa-solid fa-check"></i><template v-else>4</template></span>
            <div class="card-title">
              <h2 id="st-4">¿Cómo pagó?</h2>
              <p>Elige la forma de pago y escribe su número. Se registra una sola vez.</p>
            </div>
          </div>

          <LinkPaymentPanel
            v-model:method="paymentMethod"
            :form="formData"
            :branches="branchNames"
            :cart="cart"
            :customer-name="formData.customerName"
            :customer-phone="formData.customerPhone"
          />

          <div class="extras">
            <div class="seller">
              <i class="fa-solid fa-user-tie" aria-hidden="true"></i>
              <span>Vendedor: <strong>{{ formData.sellerName || 'sin asignar' }}</strong></span>
              <button type="button" class="link" :aria-expanded="sellerOpen" @click="sellerOpen = !sellerOpen">cambiar</button>
              <ul v-if="sellerOpen" class="seller-menu" role="listbox" aria-label="Vendedor">
                <li>
                  <button type="button" role="option" :aria-selected="!formData.sellerIdentification" @click="pickSeller('')">Sin vendedor</button>
                </li>
                <li v-for="seller in sellersForSource" :key="seller._id">
                  <button
                    type="button"
                    role="option"
                    :aria-selected="formData.sellerIdentification === seller.identification"
                    :class="{ on: formData.sellerIdentification === seller.identification }"
                    @click="pickSeller(seller.identification)"
                  >
                    {{ seller.name }}
                  </button>
                </li>
              </ul>
            </div>
            <button type="button" class="link" @click="showNotes = !showNotes">
              <i class="fa-regular fa-note-sticky"></i> {{ showNotes ? 'Quitar nota interna' : 'Agregar nota interna' }}
            </button>
            <div v-if="showNotes" class="field">
              <label for="cl-notes">Nota interna <span class="opt">no la ve el cliente</span></label>
              <textarea id="cl-notes" v-model="formData.comments" rows="2" placeholder="Detalles para producción o el equipo…"></textarea>
            </div>
          </div>
        </section>
      </div>

      <!-- Resumen fijo -->
      <aside class="summary" aria-label="Resumen de la venta">
        <div class="summary-card">
          <h2>Resumen</h2>

          <ul class="checklist">
            <li v-for="step in steps" :key="step.n" :class="{ ok: step.done }">
              <i class="fa-solid" :class="step.done ? 'fa-circle-check' : 'fa-circle'"></i>
              <div>
                <strong>{{ step.label }}</strong>
                <small>{{ step.detail }}</small>
              </div>
            </li>
          </ul>

          <dl class="totals">
            <div><dt>Productos</dt><dd>{{ money(productsTotal) }}</dd></div>
            <div v-if="isDelivery"><dt>Envío</dt><dd>{{ money(shippingTotal) }}</dd></div>
            <div class="grand"><dt>Total cobrado</dt><dd>{{ money(formData.totalValue || 0) }}</dd></div>
          </dl>

          <button type="button" class="btn-generate" :disabled="!canSubmit" @click="submit">
            <i class="fa-solid" :class="isSubmitting ? 'fa-circle-notch fa-spin' : 'fa-link'"></i>
            {{ isSubmitting ? 'Generando…' : 'Generar link para el cliente' }}
          </button>
          <p v-if="missing.length" class="missing">
            Falta: {{ missing.map(s => s.label.toLowerCase()).join(', ') }}.
          </p>
          <p v-else class="ready">Todo listo. Al generar, copias el mensaje y lo pegas en su WhatsApp.</p>
        </div>
      </aside>
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
$ink: #1e293b;
$muted: #64748b;
$line: #e7e2ea;
$ok: #16a34a;

.link-page {
  background: #f7f5f8;
  min-height: 100vh;
  padding-bottom: 4rem;
}

.container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 2rem;

  @media (max-width: 900px) {
    padding: 0 1rem;
  }
}

.page-header {
  padding-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.back-link {
  color: $muted;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  width: max-content;
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    font-size: 2.1rem;
    letter-spacing: -0.5px;
  }
}

.subtitle {
  margin: 0.3rem 0 0;
  color: $muted;
  font-size: 1rem;
}

.manual-link {
  color: $muted;
  text-decoration: none;
  font-size: 0.85rem;
  border: 1px solid $line;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  background: white;
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
}

.how {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }

  li {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    background: white;
    border: 1px solid $line;
    border-radius: 14px;
    padding: 0.85rem 1rem;
  }

  strong {
    display: block;
    color: $ink;
    font-size: 0.95rem;
  }

  small {
    color: $muted;
    font-size: 0.8rem;
  }
}

.how-n {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba($NICOLE-PURPLE, 0.1);
  color: $NICOLE-PURPLE;
  font-weight: 800;
  display: grid;
  place-items: center;
}

.layout {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 1.5rem;
  align-items: start;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.card {
  background: white;
  border: 1px solid $line;
  border-radius: 18px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  min-width: 0;
}

.card-head {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
}

.badge {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: $NICOLE-PURPLE;
  color: white;
  font-weight: 800;
  display: grid;
  place-items: center;
  transition: background 0.2s ease;

  .done & {
    background: $ok;
  }
}

.card-title {
  flex: 1;
  min-width: 0;

  h2 {
    margin: 0;
    font-size: 1.25rem;
    color: $ink;
  }

  p {
    margin: 0.2rem 0 0;
    color: $muted;
    font-size: 0.9rem;
  }
}

.chip-toggle {
  flex: none;
  border: 1px solid $line;
  background: white;
  color: $muted;
  border-radius: 999px;
  padding: 0.4rem 0.8rem;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;

  &.on {
    background: #fdf2f8;
    border-color: #db2777;
    color: #be185d;
  }
}

.catalog {
  border: 1px solid $line;
  border-radius: 14px;
  padding: 0.75rem;
  max-height: 340px;
  overflow-y: auto;
  background: #fcfbfd;
}

.picked {
  h3 {
    margin: 0 0 0.6rem;
    font-size: 0.95rem;
    color: $ink;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .count {
    background: $NICOLE-PURPLE;
    color: white;
    border-radius: 999px;
    font-size: 0.75rem;
    padding: 0.05rem 0.55rem;
  }

  .empty {
    margin: 0;
    color: $muted;
    font-size: 0.9rem;
    padding: 1rem;
    border: 1px dashed $line;
    border-radius: 12px;
    text-align: center;
  }
}

.lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 80px auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.65rem 0.75rem;
  border: 1px solid $line;
  border-radius: 12px;

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}

.line-name {
  display: flex;
  flex-direction: column;
  min-width: 0;

  span {
    font-weight: 600;
    color: $ink;
  }

  .gift {
    color: #be185d;
    font-size: 0.75rem;
  }
}

.qty {
  display: inline-flex;
  align-items: center;
  border: 1px solid $line;
  border-radius: 999px;
  overflow: hidden;

  button {
    border: none;
    background: white;
    width: 30px;
    height: 30px;
    cursor: pointer;
    color: $NICOLE-PURPLE;
  }

  span {
    min-width: 26px;
    text-align: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
}

.line-total {
  text-align: right;
  font-weight: 700;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.line-actions {
  display: flex;
  gap: 0.25rem;
}

.icon {
  border: none;
  background: transparent;
  color: #94a3b8;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: #f1f5f9;
  }

  &.on {
    color: #be185d;
  }

  &.danger:hover {
    color: #dc2626;
  }
}

.type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }

  button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    padding: 1rem 1.1rem;
    border: 2px solid $line;
    background: white;
    border-radius: 14px;
    cursor: pointer;
    text-align: left;
    color: $ink;
    transition: border-color 0.15s ease, background 0.15s ease;

    i {
      font-size: 1.3rem;
      color: $muted;
      margin-bottom: 0.3rem;
    }

    small {
      color: $muted;
    }

    &.active {
      border-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.05);

      i,
      strong {
        color: $NICOLE-PURPLE;
      }
    }
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;

  label {
    font-weight: 600;
    font-size: 0.9rem;
    color: #334155;
  }

  input,
  select,
  textarea {
    padding: 0.75rem 0.85rem;
    border: 1px solid #dcd6e0;
    border-radius: 10px;
    font-size: 1rem;
    font-family: inherit;
    background: white;
    width: 100%;
    box-sizing: border-box;

    &:focus {
      outline: 3px solid rgba($NICOLE-PURPLE, 0.18);
      border-color: $NICOLE-PURPLE;
    }
  }
}

.envio {
  max-width: 320px;
}

.money-input {
  display: flex;
  align-items: center;
  border: 1px solid #dcd6e0;
  border-radius: 10px;
  background: white;
  padding-left: 0.85rem;

  span {
    color: $muted;
    font-weight: 700;
  }

  input {
    border: none !important;
    outline: none !important;
    font-size: 1.1rem !important;
    font-weight: 700;
  }

  &:focus-within {
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.18);
  }
}

.req {
  color: #dc2626;
}

.opt {
  font-weight: 400;
  color: #94a3b8;
  font-size: 0.8rem;
}

.hint {
  color: $muted;
  font-size: 0.8rem;
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



.phone-input {
  display: flex;
  align-items: center;
  border: 1px solid #dcd6e0;
  border-radius: 12px;
  background: white;
  max-width: 360px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  .prefix {
    padding: 0 0.4rem 0 0.9rem;
    color: #25d366;
    font-size: 1.25rem;
  }

  input {
    flex: 1;
    min-width: 0;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    font-size: 1.25rem !important;
    font-weight: 700;
    letter-spacing: 0.5px;
    font-variant-numeric: tabular-nums;
    padding: 0.8rem 0.5rem !important;
  }

  .ok-icon {
    color: $ok;
    padding-right: 0.9rem;
  }

  &:focus-within {
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.18);
  }
}

.phone-field.invalid .phone-input {
  border-color: #dc2626;
}

.error {
  color: #dc2626;
  font-size: 0.8rem;
}

.extras {
  border-top: 1px solid $line;
  padding-top: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  align-items: flex-start;
}

.seller {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  color: $muted;
  font-size: 0.9rem;

  strong {
    color: $ink;
  }
}

.seller-menu {
  font-family: inherit;

  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  list-style: none;
  margin: 0;
  padding: 0.35rem;
  min-width: 260px;
  max-height: 260px;
  overflow-y: auto;
  background: white;
  border: 1px solid $line;
  border-radius: 12px;
  box-shadow: 0 16px 32px rgba(30, 41, 59, 0.12);

  button {
    font-family: inherit;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    color: $ink;

    &:hover {
      background: rgba($NICOLE-PURPLE, 0.06);
    }

    &.on {
      background: rgba($NICOLE-PURPLE, 0.1);
      color: $NICOLE-PURPLE;
      font-weight: 700;
    }
  }
}

.link {
  font-family: inherit;
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

.summary {
  position: sticky;
  top: 1.5rem;

  @media (max-width: 980px) {
    position: static;
  }
}

.summary-card {
  background: white;
  border: 1px solid $line;
  border-radius: 18px;
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  box-shadow: 0 12px 30px rgba(73, 29, 70, 0.06);

  h2 {
    margin: 0;
    font-size: 1.1rem;
    color: $ink;
  }
}

.checklist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;

  li {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;

    i {
      color: #cbd5e1;
      margin-top: 3px;
    }

    strong {
      display: block;
      font-size: 0.92rem;
      color: $ink;
    }

    small {
      color: $muted;
      font-size: 0.8rem;
    }

    &.ok i {
      color: $ok;
    }
  }
}

.totals {
  margin: 0;
  border-top: 1px dashed $line;
  padding-top: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  div {
    display: flex;
    justify-content: space-between;
  }

  dt {
    color: $muted;
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .grand {
    margin-top: 0.3rem;

    dt {
      color: $ink;
      font-weight: 700;
    }

    dd {
      font-size: 1.6rem;
      font-weight: 800;
      color: $NICOLE-PURPLE;
    }
  }
}

.btn-generate {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 1rem;
  font-size: 1.02rem;
  font-weight: 800;
  background: $NICOLE-PURPLE;
  color: white;
  cursor: pointer;
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  align-items: center;
  transition: opacity 0.15s ease, transform 0.12s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
  }
}

.missing {
  margin: 0;
  color: #b45309;
  font-size: 0.85rem;
  text-align: center;
}

.ready {
  margin: 0;
  color: $ok;
  font-size: 0.85rem;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>
