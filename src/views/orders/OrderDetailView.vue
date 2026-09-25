<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import OrderService from '@/services/order.service'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'

// Components
import InvoiceEditModal from './components/InvoiceEditModal.vue'
import PaymentModal from './components/PaymentModal.vue'
import OrderSummaryInfo from './components/OrderSummaryInfo.vue'
import OrderProductsList from './components/OrderProductsList.vue'
import OrderPaymentsList from './components/OrderPaymentsList.vue'
import OrderClientInfo from './components/OrderClientInfo.vue'
import OrderInvoiceInfo from './components/OrderInvoiceInfo.vue'
import InvoiceGenerationModal from './components/InvoiceGenerationModal.vue'
import OrderDeleteModal from './components/OrderDeleteModal.vue'
import OrderDeliveryAssign from './components/OrderDeliveryAssign.vue'
import OrderAuditTimeline from './components/OrderAuditTimeline.vue'
import OrderLocationEditModal from './components/OrderLocationEditModal.vue'
import OrderWebInfo from './components/OrderWebInfo.vue'
import WebOrderContacts from './components/WebOrderContacts.vue'
import { useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const order = ref<any>(null)
const isLoading = ref(false)
const showInvoiceModal = ref(false)
const showPaymentModal = ref(false)
const showInvoiceConfirmModal = ref(false)
const showDeleteModal = ref(false)
const authStatus = ref<string | null>(null)
const isAuthLoading = ref(false)
const isPollingAuth = ref(false)
let authPollTimer: ReturnType<typeof setTimeout> | null = null


const fetchOrder = async () => {
  const id = route.params.id as string
  if (!id) return

  isLoading.value = true
  try {
    const data = await OrderService.getOrder(id)
    order.value = data
    if (data.invoiceStatus === 'PROCESSED') {
      fetchAuthStatus()
    }
  } catch (error) {
    console.error('Error fetching order:', error)
  } finally {
    isLoading.value = false
  }
}

const fetchAuthStatus = async () => {
  const id = route.params.id as string
  if (!id) return
  isAuthLoading.value = true
  try {
    const data = await OrderService.getInvoiceAuthStatus(id)
    authStatus.value = data.estado
  } catch {
    authStatus.value = null
  } finally {
    isAuthLoading.value = false
  }
}

// Poll every 6s for up to 20 attempts (2 min total) — SRI can be slow
const pollAuthStatus = (maxAttempts = 20, intervalMs = 6000) => {
  if (authPollTimer) clearTimeout(authPollTimer)
  let attempts = 0
  isPollingAuth.value = true
  const poll = async () => {
    if (attempts >= maxAttempts) {
      isPollingAuth.value = false
      return
    }
    attempts++
    await fetchAuthStatus()
    if (authStatus.value === 'Autorizado') {
      isPollingAuth.value = false
      success('¡Factura autorizada por el SRI!')
    } else {
      authPollTimer = setTimeout(poll, intervalMs)
    }
  }
  poll()
}

const handleTriggerAuth = async () => {
  const id = route.params.id as string
  isAuthLoading.value = true
  try {
    await OrderService.triggerInvoiceAuth(id)
    success('Enviado al SRI. Verificando autorización...')
    pollAuthStatus()
  } catch (e: any) {
    // El backend devuelve 4xx cuando sendToSri falla — mostrar el error real de Contífico/SRI
    const msg = e.response?.data?.message || e.data?.message || e.message || 'Error al enviar al SRI'
    showError(`No se pudo enviar al SRI: ${msg}`)
    isAuthLoading.value = false
  }
}

const handleRefreshAuthStatus = () => {
  fetchAuthStatus()
}

const handleRegenerateInvoice = async () => {
  if (!order.value) return
  const confirmed = await dialog.confirm(
    '⚠️ La nueva factura se emitirá con la fecha de HOY.\n\nLa normativa del SRI exige que los documentos electrónicos se autoricen el mismo día de su emisión. Una factura con fecha original (hace varios días) sería rechazada como extemporánea.\n\nLa factura anterior quedará inactiva en Contífico y la nueva tendrá fecha de hoy.',
    { title: 'Regenerar Factura — fecha de hoy', confirmLabel: 'Entendido, regenerar', cancelLabel: 'Cancelar', variant: 'warning' }
  )
  if (!confirmed) return
  isLoading.value = true
  try {
    await OrderService.regenerateInvoice(order.value._id)
    success('Factura regenerada. Verificando autorización SRI...')
    fetchOrder()
    authStatus.value = null
    pollAuthStatus()
  } catch (e: any) {
    const data = e.data
    const contificoMsg = data?.contificoMessage
    if (contificoMsg) {
      showError(`⚠️ Contífico rechazó la factura:<br><small>${contificoMsg}</small>`, 10000)
    } else {
      showError(data?.message || e.message || 'Error al regenerar factura')
    }
  } finally {
    isLoading.value = false
  }
}

const handleRegenerateConsumidorFinal = async () => {
  if (!order.value) return
  const confirmed = await dialog.confirm(
    '⚠️ Se emitirá una nueva factura a nombre de Consumidor Final.\n\nEsto es necesario cuando la persona en Contífico tiene tipo inválido (tipo "C") que el SRI rechaza silenciosamente. La factura quedará a nombre de Consumidor Final — no del cliente.\n\nLa factura anterior quedará inactiva en Contífico y la nueva tendrá fecha de hoy.',
    { title: 'Regenerar como Consumidor Final', confirmLabel: 'Entendido, regenerar', cancelLabel: 'Cancelar', variant: 'warning' }
  )
  if (!confirmed) return
  isLoading.value = true
  try {
    await OrderService.regenerateInvoiceConsumidorFinal(order.value._id)
    success('Factura regenerada como Consumidor Final. Verificando autorización SRI...')
    fetchOrder()
    authStatus.value = null
    pollAuthStatus()
  } catch (e: any) {
    const data = e.data
    const contificoMsg = data?.contificoMessage
    if (contificoMsg) {
      showError(`⚠️ Contífico rechazó la factura:<br><small>${contificoMsg}</small>`, 10000)
    } else {
      showError(data?.message || e.message || 'Error al regenerar factura como Consumidor Final')
    }
  } finally {
    isLoading.value = false
  }
}

const totalPaid = computed(() => {
  if (!order.value?.payments) return 0
  return order.value.payments.reduce((sum: number, p: any) => sum + (p.monto || 0), 0)
})

const computedTotal = computed(() => {
  if (!order.value) return 0
  return order.value.totalValue || 0
})

const outstandingBalance = computed(() => {
  return Math.max(0, computedTotal.value - totalPaid.value)
})

const isReturned = computed(() => order.value?.dispatchStatus === 'RETURNED')
const canReturn = computed(() => !!order.value && !isReturned.value)

const handleOrderUpdated = (updatedOrder: any) => {
  order.value = updatedOrder
}

const { success, error: showError } = useToast()
const dialog = useDialog()

const registerCollection = async (payload: any) => {
  if (!order.value) return;

  isLoading.value = true
  try {
    const response = await OrderService.registerCollection(order.value._id, payload);
    success("Cobro registrado exitosamente en Contífico.");
    showPaymentModal.value = false;
    fetchOrder();
  } catch (error: any) {
    console.error("Error registering collection:", error);
    showError(error.data?.message || error.message || "Error al registrar el cobro.");
  } finally {
    isLoading.value = false;
  }
}

const handleGenerateInvoice = () => {
  if (!order.value) return
  showInvoiceConfirmModal.value = true
}

const executeInvoiceGeneration = async () => {
  showInvoiceConfirmModal.value = false
  isLoading.value = true
  try {
    await OrderService.generateInvoice(order.value._id)
    success("Factura generada. Verificando autorización SRI...")
    fetchOrder()
    authStatus.value = null
    pollAuthStatus()
  } catch (e: any) {
    const data = e.data
    const contificoMsg = data?.contificoMessage
    if (contificoMsg) {
      showError(`⚠️ Contífico rechazó la factura:<br><small>${contificoMsg}</small>`, 10000)
    } else {
      showError(data?.message || e.message || "Error al generar factura")
    }
  } finally {
    isLoading.value = false
  }
}

const handleViewInvoice = async () => {
  if (!order.value) return
  isLoading.value = true
  try {
    const response = await OrderService.getInvoicePdf(order.value._id)
    const doc = response.document
    // Confirmed 'url_ride' is the PDF link based on user feedback
    const link = doc.url_ride || doc.pdf_link || doc.descargar_pdf || doc.url || doc.mensaje

    if (link && typeof link === 'string' && link.startsWith('http')) {
      window.open(link, '_blank')
    } else {
      showError("No se encontró enlace PDF. Revise la consola.")
      console.log("Full Doc:", doc)
    }
  } catch (e: any) {
    showError("Error al obtener PDF de la factura.")
  } finally {
    isLoading.value = false
  }
}

const executeDeleteOrder = async () => {
  if (!order.value) return
  showDeleteModal.value = false
  isLoading.value = true
  try {
    await OrderService.deleteOrder(order.value._id)
    success("La orden ha sido eliminada permanentemente.")
    router.push('/orders')
  } catch (e: any) {
    showError(e.data?.message || e.message || "Error al eliminar la orden")
  } finally {
    isLoading.value = false
  }



}

const handleReturnOrder = async () => {
  if (!order.value) return

  const notes = await dialog.prompt(`Motivo de la devolución para "${order.value.customerName}":`, {
    title: 'Devolución de Pedido',
    placeholder: 'El pedido saldrá de producción y quedará marcado como devuelto...',
    confirmLabel: 'Confirmar devolución',
    variant: 'warning'
  })
  if (notes === null) return

  isLoading.value = true
  try {
    await OrderService.returnOrder(order.value._id, notes)
    success('Pedido marcado como devuelto.')
    fetchOrder()
  } catch (err: any) {
    console.error('Return error', err)
    showError(err.data?.message || err.message || 'Error al devolver el pedido')
  } finally {
    isLoading.value = false
  }
}

// Pedido de la tienda online → gestionado
const isMarkingManaged = ref(false)

const handleMarkWebManaged = async () => {
  if (!order.value) return
  const confirmed = await dialog.confirm(
    `¿Marcar el pedido web ${order.value.webOrder?.code || ''} de "${order.value.customerName}" como gestionado?\n\nDejará de aparecer en "Web por gestionar".`,
    { title: 'Marcar como gestionado', confirmLabel: 'Sí, gestionado', cancelLabel: 'Cancelar', variant: 'info' }
  )
  if (!confirmed) return
  isMarkingManaged.value = true
  try {
    await OrderService.markWebOrderManaged(order.value._id)
    success('Pedido web marcado como gestionado.')
    await fetchOrder()
  } catch (err: any) {
    showError(err.data?.message || err.message || 'Error al marcar el pedido como gestionado')
  } finally {
    isMarkingManaged.value = false
  }
}

// Modal State
const locationModal = ref({
  isOpen: false,
  title: '',
  type: 'branch' as 'branch' | 'exitPoint' | 'deliveryAddress' | 'googleMapsLink',
  currentValue: ''
})

const openLocationModal = (type: typeof locationModal.value.type) => {
  const titles = {
    branch: 'Editar Sucursal de Retiro',
    exitPoint: 'Editar Punto de Salida',
    deliveryAddress: 'Editar Dirección de Entrega',
    googleMapsLink: 'Editar Link de Ubicación'
  }

  const values = {
    branch: order.value?.branch || '',
    exitPoint: order.value?.exitPoint || '',
    deliveryAddress: order.value?.deliveryAddress || '',
    googleMapsLink: order.value?.googleMapsLink || ''
  }

  locationModal.value = {
    isOpen: true,
    title: titles[type],
    type,
    currentValue: values[type]
  }
}

const handleLocationSave = async (payload: { type: string, value: string }) => {
  if (!order.value) return
  
  try {
    const updateData: any = {}
    updateData[payload.type] = payload.value
    
    await OrderService.updateOrder(order.value._id, updateData)
    
    success('Información actualizada correctamente')
    locationModal.value.isOpen = false
    await fetchOrder() // Refresh UI
  } catch (error: any) {
    showError('Error al actualizar la información')
  }
}

onMounted(() => {
  fetchOrder()
})

onUnmounted(() => {
  if (authPollTimer) clearTimeout(authPollTimer)
})
</script>

<template>
  <div class="order-detail-page">
    <header class="app-header">
      <div class="container">
        <div class="header-left">
          <router-link to="/orders" class="back-link">← Volver</router-link>
          <h1>Detalle del Pedido</h1>
        </div>
        <div class="header-actions">
           <button 
             v-if="order && order.invoiceStatus !== 'PROCESSED'" 
             class="btn-edit-header" 
             @click="router.push({ name: 'create-order', query: { edit: order._id } })"
           >
             <i class="fa-solid fa-pen"></i> Editar
           </button>
        </div>
      </div>
    </header>

    <main class="container" v-if="order">
      <!-- Return Banner -->
      <div v-if="isReturned" class="return-banner">
        <div class="return-banner-icon">
          <i class="fas fa-rotate-left"></i>
        </div>
        <div class="return-banner-body">
          <strong>Pedido Devuelto</strong>
          <p v-if="order.returnNotes">{{ order.returnNotes }}</p>
          <p v-else>Este pedido fue marcado como devuelto.</p>
        </div>
      </div>

      <!-- Summary Grid -->
      <OrderSummaryInfo 
        :order="order" 
        @edit-branch="openLocationModal('branch')" 
        @edit-exit-point="openLocationModal('exitPoint')"
        @edit-address="openLocationModal('deliveryAddress')"
        @edit-maps-link="openLocationModal('googleMapsLink')"
      />

      <div class="content-grid">
        <div class="main-column">
          <!-- Products -->
          <OrderProductsList 
            :products="order.products" 
            :computedTotal="computedTotal"
            :globalDiscountPercentage="order.globalDiscountPercentage"
            :isGlobalCourtesy="order.isGlobalCourtesy"
            :deliveryValue="order.deliveryValue"
            :isWebOrder="!!order.webOrder?.externalId"
          />

          <!-- Payments History -->
          <OrderPaymentsList
            style="margin-top: 1.5rem;"
            :payments="order.payments"
            :totalPaid="totalPaid"
            :outstandingBalance="outstandingBalance"
            @open-modal="showPaymentModal = true"
          />

          <!-- Audit Timeline -->
          <OrderAuditTimeline
            v-if="order"
            :audit-log="order.auditLog"
            :created-by="order.createdBy"
            :updated-by="order.updatedBy"
            :created-at="order.createdAt"
            :responsible="order.responsible"
          />
        </div>

        <!-- Details Sidebar -->
        <section class="side-info">
          <OrderWebInfo
            v-if="order.webOrder?.externalId"
            :web-order="order.webOrder"
            :status="order.status"
            :is-saving="isMarkingManaged"
            :order="order"
            @mark-managed="handleMarkWebManaged"
            @updated="fetchOrder"
          />
          <WebOrderContacts
            v-if="order.webOrder?.buyer"
            :web-order="order.webOrder"
            :customer-name="order.customerName"
            :customer-phone="order.customerPhone"
            :delivery-type="order.deliveryType"
          />

          <OrderDeliveryAssign
            v-if="order.deliveryType === 'delivery'"
            :order="order"
            @updated="handleOrderUpdated"
          />

          <OrderClientInfo
            :customerName="order.customerName"
            :customerPhone="order.customerPhone"
            :deliveryType="order.deliveryType"
            :comments="order.comments"
          />

          <OrderInvoiceInfo
            :invoiceStatus="order.invoiceStatus"
            :invoiceNeeded="order.invoiceNeeded"
            :invoiceData="order.invoiceData"
            :generatedInvoice="order.invoiceInfo"
            :invoiceSentToSriAt="order.invoiceSentToSriAt"
            :authStatus="authStatus"
            :isAuthLoading="isAuthLoading"
            :isPollingAuth="isPollingAuth"
            @open-invoice-modal="showInvoiceModal = true"
            @open-payment-modal="showPaymentModal = true"
            @generate-invoice="handleGenerateInvoice"
            @view-invoice="handleViewInvoice"
            @trigger-auth="handleTriggerAuth"
            @refresh-auth="handleRefreshAuthStatus"
            @regenerate-invoice="handleRegenerateInvoice"
            @regenerate-consumidor-final="handleRegenerateConsumidorFinal"
          />
        </section>
      </div>

      <!-- Return Section -->
      <section v-if="canReturn" class="return-section">
        <div class="return-section-header">
          <i class="fas fa-rotate-left"></i>
          <h3>Gestión de Devolución</h3>
        </div>
        <div class="return-card">
          <div class="return-card-left">
            <div class="return-card-icon">
              <i class="fas fa-box-open"></i>
            </div>
            <div class="return-card-info">
              <strong>Registrar devolución de este pedido</strong>
              <p>El pedido saldrá de producción y quedará marcado como devuelto. Se te pedirá un motivo antes de confirmar.</p>
            </div>
          </div>
          <button class="btn-return-action" @click="handleReturnOrder">
            <i class="fas fa-rotate-left"></i>
            Registrar Devolución
          </button>
        </div>
      </section>

      <!-- Danger Zone -->
      <section class="danger-zone-section" v-if="order && order.invoiceStatus !== 'PROCESSED' && !order.settledInIsland && outstandingBalance > 0.05">
        <div class="danger-header">
           <i class="fas fa-radiation"></i>
           <h3>Zona de Peligro</h3>
        </div>
        <div class="danger-card">
           <div class="danger-info">
             <strong>Eliminar este pedido</strong>
             <p>Una vez eliminado, no hay vuelta atrás. La orden y su historial desaparecerán.</p>
           </div>
           <button class="btn-danger-outline" @click="showDeleteModal = true">
             Eliminar Pedido
           </button>
        </div>
      </section>
      
    <!-- Modals -->
    <InvoiceEditModal
      :is-open="showInvoiceModal"
      :order-id="order._id"
      :invoice-needed="order.invoiceNeeded"
      :current-invoice-data="order.invoiceData"
      @close="showInvoiceModal = false"
      @saved="handleOrderUpdated"
    />

    <PaymentModal
      v-if="order && showPaymentModal"
      :is-open="showPaymentModal"
      :order-id="order._id"
      :default-amount="outstandingBalance"
      @close="showPaymentModal = false"
      @submit="registerCollection"
    />

    <InvoiceGenerationModal
      v-if="order && showInvoiceConfirmModal"
      :is-open="showInvoiceConfirmModal"
      :invoice-data="order.invoiceData"
      :total-value="computedTotal"
      @close="showInvoiceConfirmModal = false"
      @confirm="executeInvoiceGeneration"
    />

    <OrderDeleteModal
      v-if="order"
      :is-open="showDeleteModal"
      :order-id="order._id"
      :customer-name="order.customerName"
      @close="showDeleteModal = false"
      @confirm="executeDeleteOrder"
    />

    <OrderLocationEditModal
      :is-open="locationModal.isOpen"
      :title="locationModal.title"
      :current-value="locationModal.currentValue"
      :type="locationModal.type"
      @close="locationModal.isOpen = false"
      @save="handleLocationSave"
    />
    </main>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Mobile First Layout Styles */

.order-detail-page {
  background-color: #f8fafc;
  min-height: 100vh;
  padding-bottom: 2rem;
}

.app-header {
  background-color: white;
  border-bottom: 1px solid $border-light;
  padding: 1rem 0;
  margin-bottom: 1.5rem;

  .container {
    display: flex;
    align-items: center;
    justify-content: space-between; // Ensure spacing between left and right
    margin: 0 auto;
    padding: 0 1rem;
    max-width: 1280px;
  }
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn-edit-header {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
  font-size: 0.9rem;

  &:hover {
    border-color: #3b82f6;
    color: #2563eb;
    background: #eff6ff;
  }

  i {
    font-size: 0.9rem;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;

  h1 {
    margin: 0;
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    font-size: 1.4rem;
    font-weight: 700;
  }

  .back-link {
    text-decoration: none;
    color: $text-light;
    font-weight: 600;
    background: white;
    padding: 0.4rem 0.8rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-size: 0.85rem;
    white-space: nowrap;

    &:hover {
      color: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
    }
  }
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* Layout Grid */
.content-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.main-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.side-info {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.loading-state {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99;

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.2);
    border-top-color: $NICOLE-PURPLE;
    border-radius: 50%;
    animation: spin 0.8s infinite linear;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* MEDIA QUERIES */
@media (min-width: 768px) {
  .header-left h1 {
    font-size: 1.8rem;
  }

}

@media (min-width: 1024px) {
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 380px;
    /* Sidebar layout */
    align-items: start;
  }

  .side-info {
    position: sticky;
    top: 2rem;
  }
}

/* Danger Zone Styles */
.danger-zone-section {
  margin-top: 4rem;
  border-top: 1px solid #fee2e2;
  padding-top: 2rem;
  margin-bottom: 2rem;

  .danger-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: #dc2626;
    margin-bottom: 1rem;

    i {
      font-size: 1.2rem;
    }

    h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
}

.danger-card {
  background: white;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;

  @media (max-width: 640px) {
    flex-direction: column;
    text-align: center;
  }

  .danger-info {
    text-align: left;

    strong {
      display: block;
      color: #111827;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }

    p {
      margin: 0;
      color: #6b7280;
      font-size: 0.85rem;
    }
  }

  .btn-danger-outline {
    background: transparent;
    border: 2px solid #ef4444;
    color: #ef4444;
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover {
      background: #ef4444;
      color: white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    }
  }

  .btn-warning-outline {
    background: transparent;
    border: 2px solid #f59e0b;
    color: #f59e0b;
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover {
      background: #f59e0b;
      color: white;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
    }
  }
}

.mb-4 {
  margin-bottom: 1rem;
}

/* Return Banner (already returned) */
.return-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #fff7ed;
  border: 1.5px solid #fed7aa;
  border-left: 5px solid #f97316;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;

  .return-banner-icon {
    width: 44px;
    height: 44px;
    background: #f97316;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.15rem;
    flex-shrink: 0;
  }

  .return-banner-body {
    strong {
      display: block;
      color: #c2410c;
      font-size: 1rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 0.2rem;
    }

    p {
      margin: 0;
      color: #9a3412;
      font-size: 0.9rem;
      line-height: 1.5;
    }
  }
}

/* Return Action Section */
.return-section {
  margin-top: 2.5rem;
  border-top: 1px solid #fed7aa;
  padding-top: 2rem;
  margin-bottom: 0;

  .return-section-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: #ea580c;
    margin-bottom: 1rem;

    i {
      font-size: 1.1rem;
    }

    h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
}

.return-card {
  background: white;
  border: 1.5px solid #fed7aa;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;

  @media (max-width: 640px) {
    flex-direction: column;
    text-align: center;
  }

  .return-card-left {
    display: flex;
    align-items: center;
    gap: 1rem;

    @media (max-width: 640px) {
      flex-direction: column;
    }
  }

  .return-card-icon {
    width: 48px;
    height: 48px;
    background: #fff7ed;
    border: 1.5px solid #fed7aa;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f97316;
    font-size: 1.3rem;
    flex-shrink: 0;
  }

  .return-card-info {
    strong {
      display: block;
      color: #111827;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }

    p {
      margin: 0;
      color: #6b7280;
      font-size: 0.85rem;
      line-height: 1.5;
    }
  }
}

.btn-return-action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fff7ed;
  border: 2px solid #f97316;
  color: #ea580c;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  i {
    font-size: 0.95rem;
  }

  &:hover {
    background: #f97316;
    color: white;
    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
  }

  @media (max-width: 640px) {
    width: 100%;
    justify-content: center;
  }
}
</style>
