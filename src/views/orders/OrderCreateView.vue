<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed } from 'vue'
import OrderService from '@/services/order.service'
import { useRouter, useRoute } from 'vue-router'
import type { Product, CartItem, OrderFormData } from '@/types/order'
import { useToast } from '@/composables/useToast'

// Components
import OrderProductSelector from './components/OrderProductSelector.vue'
import OrderForm from './components/OrderForm.vue'
import { isPrecioIvaIncluido } from '@/constants/pricing'
import OrderCart from './components/OrderCart.vue'
import OrderWhatsAppModal from './components/OrderWhatsAppModal.vue'
import OrderConfirmationModal from './components/OrderConfirmationModal.vue'

const router = useRouter()
const route = useRoute()
const { success, error: showError, info } = useToast()

// UI State
const isSubmitting = ref(false)
const showWhatsAppModal = ref(false)
const showConfirmationModal = ref(false)
const generatedWhatsAppMessage = ref('')
const createdOrderId = ref<string | null>(null)
const isCourtesyMode = ref(false)
const isEditMode = ref(false)
const editingOrderId = ref<string | null>(null)
const originalOrder = ref<OrderFormData | null>(null)

// Form Data - Strictly Typed
const formData = reactive<OrderFormData>({
  customerName: '',
  customerPhone: '',
  deliveryDate: '',
  deliveryTime: '',
  deliveryType: 'pickup',
  branch: '', // Dynamic
  deliveryAddress: '',
  googleMapsLink: '',
  invoiceNeeded: false,
  comments: '',
  responsible: 'Web',
  sellerIdentification: '',
  sellerName: '',
  salesChannel: 'Web',
  paymentMethod: 'Por confirmar',
  invoiceData: {
    ruc: '',
    businessName: '',
    email: '',
    address: ''
  },
  totalValue: 0,
  // Default Payment at Creation
  registerPaymentNow: false,
  isCredit: false,
  settledInIsland: false,
  settledIslandName: 'San Marino',
  paymentDetails: {
    forma_cobro: 'TRA',
    monto: 0,
    fecha: new Date().toISOString().split('T')[0] || '',
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

// Cart
const cart = ref<CartItem[]>([])

// Fuente activa del carrito: determinada por el primer producto añadido.
// Previene mezcla de productos de distintos Contificos (no se puede facturar de dos empresas en una sola orden).
const activeCartSource = computed<'nicole' | 'sucree' | null>(() => {
  const firstItem = cart.value[0]
  if (!firstItem) return null
  return firstItem.source || 'nicole'
})

// Sync totalValue with Cart & Discounts
watch([cart, () => formData.globalDiscountPercentage, () => formData.isGlobalCourtesy], ([newCart, discount, isGlobalCourtesy]) => {
  if (isGlobalCourtesy) {
    formData.totalValue = 0
    return
  }

  const subtotal = newCart.reduce((sum, item) => {
    let itemDiscount = item.isCourtesy ? 100 : 0
    if (discount && discount > 0 && itemDiscount < 100) {
      itemDiscount = discount
    }
    const itemTotal = (item.price * item.quantity) * ((100 - itemDiscount) / 100)
    return sum + itemTotal
  }, 0)

  const iva = newCart.reduce((sum, item) => {
    // Delivery y Torta Personalizada ya traen el IVA en el precio tecleado
    if (isPrecioIvaIncluido(item)) return sum

    let itemDiscount = item.isCourtesy ? 100 : 0
    if (discount && discount > 0 && itemDiscount < 100) {
      itemDiscount = discount
    }
    const itemTotal = (item.price * item.quantity) * ((100 - itemDiscount) / 100)
    return sum + (itemTotal * 0.15)
  }, 0)

  formData.totalValue = Number((subtotal + iva).toFixed(2))
}, { deep: true })

// Sync Courtesy Modes: Bi-directional
watch(() => formData.isGlobalCourtesy, (newVal) => {
  isCourtesyMode.value = !!newVal
})

watch(isCourtesyMode, (newVal) => {
  if (formData.isGlobalCourtesy !== newVal) {
    formData.isGlobalCourtesy = newVal
  }
})

const addToCart = (product: Product) => {
  const existing = cart.value.find(item => item.contifico_id === product.id)
  const price = isCourtesyMode.value ? 0 : parseFloat(product.pvp1 || '0')

  if (existing) {
    if (product.pvp_manual) {
      // Precio manual (ej. Delivery): actualizar precio sin cambiar cantidad
      existing.price = price
    } else {
      existing.quantity++
    }
  } else {
    cart.value.push({
      id: product.id,
      contifico_id: product.id,
      name: product.nombre,
      price: price,
      quantity: 1,
      isCourtesy: isCourtesyMode.value,
      source: product.source
    })
  }
}

const removeFromCart = (index: number) => {
  cart.value.splice(index, 1)
}

const updateQuantity = (index: number, change: number) => {
  const item = cart.value[index]
  if (item) {
    item.quantity += change
    if (item.quantity < 1) {
      removeFromCart(index)
    }
  }
}

const toggleItemCourtesy = (index: number) => {
  if (cart.value[index]) {
    cart.value[index].isCourtesy = !cart.value[index].isCourtesy
  }
}

const onCartSubmit = () => {
  if (cart.value.length === 0) {
    info("El carrito está vacío.")
    return
  }

  // Frontend Validation
  if (!formData.customerName) { showError("Nombre del cliente es obligatorio"); return; }
  if (!formData.customerPhone) { showError("Teléfono del cliente es obligatorio"); return; }
  if (!formData.deliveryDate) { showError("Fecha de entrega es obligatoria"); return; }
  if (!formData.deliveryTime) { showError("Hora de entrega es obligatoria"); return; }
  if (!formData.branch) { showError("Sucursal de origen es obligatoria"); return; }

  // Double check if there's a delivery product but type is pickup
  const hasDeliveryProduct = cart.value.find(item =>
    item.name.toLowerCase().includes('delivery') || item.name.toLowerCase().includes('envío')
  )
  if (hasDeliveryProduct && formData.deliveryType !== 'delivery') {
    formData.deliveryType = 'delivery'
  }
  if (formData.deliveryType === 'delivery') {
    if (!formData.deliveryAddress) { showError("Dirección de entrega es obligatoria para Delivery"); return; }
    if (!formData.googleMapsLink) { showError("Link de Google Maps es obligatorio para Delivery"); return; }
    if (!formData.deliveryPerson?.personId) { showError("Debe seleccionar un motorizado para pedidos con envío."); return; }
  }

  if (formData.invoiceNeeded) {
    if (!formData.invoiceData.ruc) { showError("RUC/Cédula es obligatorio para factura"); return; }
  }

  if (formData.settledInIsland && !formData.settledIslandName) {
    showError("Debe seleccionar la isla donde se facturó.");
    return;
  }

  // Show Confirmation Modal
  showConfirmationModal.value = true
}

const executeOrderAction = async () => {
  showConfirmationModal.value = false
  isSubmitting.value = true

  try {
    const payload = {
      ...formData,
      // Handle Credit Sale override
      ...(formData.isCredit ? {
        registerPaymentNow: true,
        paymentDetails: {
          ...formData.paymentDetails,
          forma_cobro: 'CR',
          monto: formData.totalValue,
          fecha: new Date().toISOString().split('T')[0]
        }
      } : {}),
      // Si es retiro directo de tienda, marcar producción como finalizada
      ...(formData.skipProduction ? {
        productionStage: 'FINISHED' as const,
        skipProduction: true,
        exitPoint: formData.exitPoint
      } : {}),
      products: cart.value.map(item => ({
        contifico_id: item.contifico_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        isCourtesy: item.isCourtesy || false,
        source: item.source  // Needed by backend to pick the right Contifico account
      })),
    }

    if (isEditMode.value && editingOrderId.value) {
      await OrderService.updateOrder(editingOrderId.value, payload)
      success('Pedido actualizado correctamente')
      router.push('/orders')
    } else {
      const response = await OrderService.createOrder(payload)
      generatedWhatsAppMessage.value = response.whatsappMessage
      createdOrderId.value = response.order._id // Capture Created Order ID from response.order
      resetForm()
      showWhatsAppModal.value = true
    }
  } catch (e: any) {
    showError(e.response?.data?.message || e.message || 'Error processing order. Please try again.')
    console.error(e)
  } finally {
    isSubmitting.value = false
  }
}

const resetForm = () => {
  // Reset Form Data
  Object.assign(formData, {
    customerName: '',
    customerPhone: '',
    deliveryDate: '',
    deliveryTime: '',
    deliveryType: 'pickup',
    branch: '',
    deliveryAddress: '',
    googleMapsLink: '',
    invoiceNeeded: false,
    comments: '',
    responsible: 'Web',
    sellerIdentification: '',
    sellerName: '',
    salesChannel: 'Web',
    paymentMethod: 'Por confirmar',
    invoiceData: { ruc: '', businessName: '', email: '', address: '' },
    totalValue: 0,
    registerPaymentNow: false,
    isCredit: false,
    settledInIsland: false,
    settledIslandName: '',
    paymentDetails: {
      forma_cobro: 'TRA',
      monto: 0,
      fecha: new Date().toISOString().split('T')[0] || '',
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

  // Clear Cart & State
  cart.value = []
  isCourtesyMode.value = false
  // generatedWhatsAppMessage.value = '' // Keep message for modal

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const sendWhatsApp = () => {
  const encoded = encodeURIComponent(generatedWhatsAppMessage.value)
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
  showWhatsAppModal.value = false
}

onMounted(async () => {
  const editId = route.query.edit as string
  if (editId) {
    isEditMode.value = true
    editingOrderId.value = editId
    try {
      const order = await OrderService.getOrder(editId)

      // Map back to formData
      Object.assign(formData, {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryDate: order.deliveryDate ? order.deliveryDate.split('T')[0] : '',
        deliveryTime: order.deliveryTime,
        deliveryType: order.deliveryType,
        branch: order.branch,
        deliveryAddress: order.deliveryAddress,
        googleMapsLink: order.googleMapsLink,
        invoiceNeeded: order.invoiceNeeded,
        comments: order.comments,
        responsible: order.responsible,
        sellerIdentification: order.sellerIdentification || '',
        sellerName: order.sellerName || '',
        salesChannel: order.salesChannel,
        paymentMethod: order.paymentMethod,
        invoiceData: order.invoiceData || { ruc: '', businessName: '', email: '', address: '' },
        totalValue: order.totalValue,
        settledInIsland: order.settledInIsland || false,
        settledIslandName: order.settledIslandName || 'San Marino',
        globalDiscountPercentage: order.globalDiscountPercentage || 0,
        isGlobalCourtesy: order.isGlobalCourtesy || false,
        skipProduction: order.skipProduction || false,
        exitPoint: order.exitPoint || '',
        payments: order.payments || []
      })

      // Store initial state for change detection (Deep Clone)
      originalOrder.value = JSON.parse(JSON.stringify(formData))

      // Map back to cart
      cart.value = order.products.map((p: any) => ({
        id: p.contifico_id,
        contifico_id: p.contifico_id,
        name: p.name,
        price: p.price,
        quantity: p.quantity,
        isCourtesy: p.isCourtesy || false
      }))

    } catch (err) {
      console.error('Error loading order for edit:', err)
      showError('Error al cargar el pedido para editar.')
      router.push('/orders')
    }
  }
})
</script>

<template>
  <div class="order-page">
    <header class="container page-header">
      <div class="header-content">
          <router-link to="/orders" class="back-link">← Cancelar</router-link>
          <h1>{{ isEditMode ? 'Actualizar Orden' : 'Nuevo Pedido' }}</h1>
        <div v-if="isEditMode" class="edit-badge">
           <i class="fa-solid fa-pen-to-square"></i>
           Modo Edición
        </div>
        <div class="header-actions">
           <div v-if="isEditMode" class="edit-mode-indicator">
             <i class="fa-solid fa-lock"></i> Responsable: {{ formData.responsible }}
           </div>
        </div>
      </div>
    </header>

    <!-- Warning for Paid Orders -->
    <div v-if="isEditMode && formData.payments && formData.payments.length > 0" class="container">
      <div class="warning-banner">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div class="warning-content">
          <strong>Advertencia: Este pedido tiene pagos registrados.</strong>
          <p>Cualquier cambio en los productos o valores debe ser revisado manualmente en la sección de pagos.</p>
        </div>
      </div>
    </div>

    <main class="container main-content">
      <!-- Left Column: Product Selection -->
      <section class="left-column">
        <div class="mode-toggle-container">
           <button 
             class="btn-courtesy-toggle" 
             :class="{ active: isCourtesyMode }"
             @click="isCourtesyMode = !isCourtesyMode"
             title="Afecta solo a productos que agregues ahora"
           >
             <i class="fa-solid fa-gift"></i>
             {{ isCourtesyMode ? 'Modo Cortesía (Próximos Items)' : 'Activar Cortesía Items' }}
           </button>
        </div>
        <OrderProductSelector :active-cart-source="activeCartSource" @add-to-cart="addToCart" />
      </section>

      <!-- Right Column: Order Details & Cart -->
      <section class="order-form-section">
        <OrderForm v-model="formData" :is-edit-mode="isEditMode" :contifico-source="activeCartSource" />
        
        <OrderCart 
          :cart="cart" 
          :is-submitting="isSubmitting"
          :has-rider="!!formData.deliveryPerson?.personId"
          :is-edit-mode="isEditMode"
          :global-discount-percentage="formData.globalDiscountPercentage"
          :is-global-courtesy="formData.isGlobalCourtesy"
          @remove="removeFromCart"
          @update-quantity="updateQuantity"
          @toggle-courtesy="toggleItemCourtesy"
          @submit="onCartSubmit"
        />
      </section>
    </main>

    <!-- Confirmation Modal -->
    <OrderConfirmationModal
      :is-open="showConfirmationModal"
      :order-data="formData"
      :original-order="originalOrder"
      :cart="cart"
      @close="showConfirmationModal = false"
      @confirm="executeOrderAction"
    />

    <!-- WhatsApp Modal -->
    <OrderWhatsAppModal 
      :is-open="showWhatsAppModal" 
      :message="generatedWhatsAppMessage"
      :order-id="createdOrderId"
      @close="showWhatsAppModal = false"
      @send="sendWhatsApp"
    />
  </div>
</template>

<style lang="scss" scoped>
.order-page {
  background-color: #f8fafc; // Light background for the whole page
  min-height: 100vh;
}

.app-header {
  background-color: white;
  border-bottom: 1px solid $border-light;
  padding: 1rem 0;
  // margin-bottom removed to merge with page-header nicely
}

.page-header {
  padding: 2rem 0;
  margin-bottom: 1rem;

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -1px;
    display: flex;
    align-items: center;
    gap: 0.75rem;

    &::before {
      content: '';
      display: block;
      width: 6px;
      height: 32px;
      background: $NICOLE-PURPLE;
      border-radius: 4px;
    }
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .edit-badge {
    background: #fff7ed;
    color: #c2410c;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 700;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid #fed7aa;
    animation: fadeIn 0.3s ease;
  }
}

.edit-mode-indicator {
  font-size: 0.85rem;
  color: #64748b;
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;

  i {
    color: #6366f1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 450px; // Slightly wider right column
  gap: 2.5rem;
  padding-bottom: 4rem;
  align-items: start; // Important for sticky

  @media (max-width: 1024px) {
    grid-template-columns: 1fr 400px;
    gap: 1.5rem;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.container {
  max-width: 1400px; // Wider container
  margin: 0 auto;
  padding: 0 2rem;
}

@media (max-width: 900px) {
  .main-content {
    grid-template-columns: 1fr;
    padding-bottom: 2rem;
  }

  .container {
    padding: 0 1rem;
  }
}

.order-form-section {
  position: sticky;
  top: 2rem;
  height: max-content;
  // Ensure it doesn't get cut off if too tall, though sticky works best for bounded content
  // Adding max-height and overflow if needed, but form might be long.
  // For now, let's keep basic sticky. 
}

.mode-toggle-container {
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid $border-light;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  flex-wrap: wrap;
  gap: 1rem;
}

.btn-courtesy-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  border: 2px solid $NICOLE-PURPLE;
  background-color: white;
  color: $NICOLE-PURPLE;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: $font-principal;
  font-size: 0.95rem;

  &:hover {
    background-color: rgba($NICOLE-PURPLE, 0.05);
    transform: translateY(-1px);
  }

  &.active {
    background-color: $NICOLE-PURPLE;
    color: white;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.3);
  }
}
</style>

<style lang="scss" scoped>
.warning-banner {
  background-color: #fff7ed;
  border: 1px solid #fed7aa;
  border-left: 4px solid #f97316;
  color: #c2410c;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2rem;
  animation: fadeIn 0.3s ease;

  i {
    font-size: 1.25rem;
    margin-top: 2px;
  }

  .warning-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    strong {
      font-size: 1rem;
    }

    p {
      margin: 0;
      font-size: 0.9rem;
      opacity: 0.9;
    }
  }
}
</style>
