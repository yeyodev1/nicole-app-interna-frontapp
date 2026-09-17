<script setup lang="ts">
import type { OrderFormData } from '@/types/order'
import { computed, ref, watch, onMounted } from 'vue'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import { deliveryService, type DeliveryPerson } from '@/services/delivery.service'
import orderService from '@/services/order.service'
import { useBranches } from '@/composables/useBranches'
import { useSellers } from '@/composables/useSellers'
import PaymentFields from './PaymentFields.vue'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'
import CustomTimeSelect from '@/components/ui/CustomTimeSelect.vue'
import OrderPaymentSelector from './OrderPaymentSelector.vue'
import DeliveryPersonFormModal from '@/components/modals/DeliveryPersonFormModal.vue'

const props = defineProps<{
  modelValue: OrderFormData,
  isEditMode?: boolean,
  /** Cuenta de Contífico del carrito. `null` mientras no haya productos. */
  contificoSource?: 'nicole' | 'sucree' | null
}>()

const dialog = useDialog()
const toast = useToast()
const { branchNames, load: loadBranches } = useBranches()
const BRANCHES = branchNames
const { activeSellers, load: loadSellers } = useSellers()

// El vendedor tiene que ser de la misma cuenta que el pedido: el backend valida la
// cédula contra el catálogo filtrando por `contificoSource`, así que ofrecer los de
// la otra empresa sólo produce un 400 al guardar.
const sellersForSource = computed(() => {
  if (!props.contificoSource) return activeSellers.value
  return activeSellers.value.filter(s => s.contificoSource === props.contificoSource)
})

// Si el carrito cambia de empresa, el vendedor ya elegido deja de ser válido.
watch(sellersForSource, (list) => {
  const current = props.modelValue.sellerIdentification
  if (current && !list.some(s => s.identification === current)) {
    props.modelValue.sellerIdentification = undefined
    props.modelValue.sellerName = undefined
  }
})

const isDelivery = computed(() => props.modelValue.deliveryType === 'delivery')

// --- Delivery Personnel Logic ---
const riders = ref<DeliveryPerson[]>([])
const isRiderModalOpen = ref(false)

const fetchRiders = async () => {
  try {
    riders.value = await deliveryService.getPersonnel()
  } catch (error) {
    console.error('Error fetching delivery personnel:', error)
  }
}

onMounted(() => {
  fetchRiders()
  loadBranches()
  loadSellers()
})

// El nombre del vendedor viaja junto a la cédula para que el pedido lo muestre
// sin tener que volver a consultar el catálogo.
const handleSellerChange = (e: Event) => {
  const identification = (e.target as HTMLSelectElement).value
  const seller = sellersForSource.value.find(s => s.identification === identification)
  props.modelValue.sellerIdentification = seller?.identification
  props.modelValue.sellerName = seller?.name
}

const handleRiderChange = (e: Event) => {
  const target = e.target as HTMLSelectElement
  if (target.value === 'new') {
    isRiderModalOpen.value = true
    // Reset selection to prevent staying on 'new'
    target.value = ''
  } else if (target.value === '') {
    props.modelValue.deliveryPerson = undefined
  } else {
    const rider = riders.value.find(r => r._id === target.value)
    if (rider) {
      props.modelValue.deliveryPerson = {
        name: rider.name,
        identification: rider.identification,
        personId: rider._id
      }
      props.modelValue.deliveryType = 'delivery'
    }
  }
}

const handleRiderSave = async (personData: Partial<DeliveryPerson>) => {
  try {
    const created = await deliveryService.createPerson(personData)
    riders.value.push(created)
    props.modelValue.deliveryPerson = {
      name: created.name,
      identification: created.identification,
      personId: created._id
    }
    props.modelValue.deliveryType = 'delivery'
    isRiderModalOpen.value = false
  } catch (error) {
    await dialog.alert('Error al guardar motorizado o transporte.', { variant: 'error', title: 'Error' })
  }
}

// --- Date & Time Logic ---

// 1. Min Date = Today
const minDate = computed(() => {
  const now = new Date()
  // Format: YYYY-MM-DD
  return now.toISOString().split('T')[0]
})

// 2. Time Validation & Suggestions
const timeError = computed(() => {
  if (!props.modelValue.deliveryDate || !props.modelValue.deliveryTime) return null

  const selectedDate = props.modelValue.deliveryDate
  const selectedTime = props.modelValue.deliveryTime

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Only validate 2-hour window if the selected date is TODAY
  if (selectedDate === todayStr) {
    const parts = selectedTime.split(':')
    const hours = Number(parts[0]) || 0
    const minutes = Number(parts[1]) || 0

    const selectedDateTime = new Date(now)
    selectedDateTime.setHours(hours, minutes, 0, 0)

    const diffInMs = selectedDateTime.getTime() - now.getTime()
    const diffInHours = diffInMs / (1000 * 60 * 60)

    if (diffInHours < 2) {
      return 'El pedido debe hacerse con al menos 2 horas de anticipación.'
    }
  }
  return null
})

const quickTimes = [
  { label: 'Mañana', time: '10:00' },
  { label: 'Mediodía', time: '13:00' },
  { label: 'Tarde', time: '16:00' },
  { label: 'Noche', time: '19:00' }
]

// 3. Time Slots Generator (15 min intervals)
const getTimeOptions = () => {
  const slots: string[] = []
  const startHour = 7 // 7 AM
  const endHour = 20 // 8 PM

  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = h.toString().padStart(2, '0')
      const mm = m.toString().padStart(2, '0')
      slots.push(`${hh}:${mm}`)
    }
  }
  return slots
}
const timeOptions = getTimeOptions()

const selectTime = (time: string) => {
  props.modelValue.deliveryTime = time
}

// --- Invoice ID validation ---
const rucHasError = computed(() => {
  const ruc = (props.modelValue.invoiceData?.ruc || '').trim()
  if (!ruc) return false
  const digits = ruc.replace(/\D/g, '')
  return digits.length !== 10 && digits.length !== 13
})

// Una vez que el RUC tiene 10 o 13 dígitos válidos, el tipo de persona se bloquea
// para evitar que el usuario lo cambie manualmente y cause errores en el SRI.
const personTypeLocked = computed(() => {
  const ruc = (props.modelValue.invoiceData?.ruc || '').trim()
  const digits = ruc.replace(/\D/g, '')
  return digits.length === 10 || digits.length === 13
})

// Show a warning toast when an invalid length is detected (only when value changes to invalid)
watch(rucHasError, (hasError) => {
  if (hasError) {
    const ruc = (props.modelValue.invoiceData?.ruc || '').trim()
    const digits = ruc.replace(/\D/g, '')
    toast.warning(
      `<strong>Identificación inválida</strong><br>Tiene ${digits.length} dígitos — debe ser cédula (10) o RUC (13).`,
      5000
    )
  }
})

// Auto-select personType + search persona in Contifico
const isSearchingPersona = ref(false)
const personaSearchStatus = ref<'idle' | 'found' | 'not-found'>('idle')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const onRucInput = () => {
  const ruc = (props.modelValue.invoiceData?.ruc || '').trim()
  const digits = ruc.replace(/\D/g, '')

  if (digits.length === 13) {
    props.modelValue.invoiceData!.personType = 'juridica'
  } else if (digits.length === 10) {
    props.modelValue.invoiceData!.personType = 'natural'
  }

  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)

  // Reset state when user keeps typing
  if (digits.length < 10) {
    personaSearchStatus.value = 'idle'
    isSearchingPersona.value = false
    return
  }

  if (digits.length === 10 || digits.length === 13) {
    personaSearchStatus.value = 'idle'
    searchDebounceTimer = setTimeout(async () => {
      isSearchingPersona.value = true
      const persona = await orderService.searchPersona(digits)
      isSearchingPersona.value = false
      if (persona) {
        props.modelValue.invoiceData!.businessName = persona.razon_social || props.modelValue.invoiceData!.businessName
        props.modelValue.invoiceData!.email = persona.email || props.modelValue.invoiceData!.email
        props.modelValue.invoiceData!.address = persona.direccion || props.modelValue.invoiceData!.address
        personaSearchStatus.value = 'found'
      } else {
        personaSearchStatus.value = 'not-found'
      }
    }, 400)
  }
}
</script>

<template>
  <div class="card">
    <div class="section-header">
      <h2>Datos del Pedido</h2>
    </div>

    <div class="form-grid">
      <!-- 1. Clasificación del Pedido -->
      <div class="form-group full-width">
        <label class="required-label">Sucursal de Origen / Retiro</label>
        <div class="radio-group">
          <label v-for="branch in BRANCHES" :key="branch" class="radio-label">
            <input type="radio" v-model="props.modelValue.branch" :value="branch" />
            {{ branch }}
          </label>
        </div>
      </div>

      <div class="form-group" v-if="props.isEditMode">
        <label>Responsable Original</label>
        <div class="read-only-field">
          <i class="fa-solid fa-user-shield"></i>
          {{ props.modelValue.responsible }}
        </div>
      </div>

      <div class="form-group">
        <label>Vendedor a cargo</label>
        <select :value="props.modelValue.sellerIdentification || ''" @change="handleSellerChange">
          <option value="">Sin vendedor asignado</option>
          <option v-for="seller in sellersForSource" :key="seller._id" :value="seller.identification">
            {{ seller.name }}
          </option>
        </select>
        <small class="hint">Sale en la factura de Contífico — es la base del cálculo de comisiones.</small>
      </div>

      <div class="form-group">
        <label class="required-label">Tipo de Entrega</label>
        <select v-model="props.modelValue.deliveryType">
          <option value="pickup">Retiro en Local</option>
          <option value="delivery">Delivery</option>
        </select>
      </div>

      <!-- 2. Fecha y Hora Exacta -->
      <div class="form-group full-width">
        <CustomDatePicker
          label="Fecha de Entrega"
          v-model="props.modelValue.deliveryDate"
          required
        />
      </div>

      <div class="form-group">
        <CustomTimeSelect
           label="Hora Exacta"
           v-model="props.modelValue.deliveryTime"
           :options="timeOptions"
           required
           hint="Intervalos de 15 minutos."
        />
        
        <div class="quick-times">
          <button 
            v-for="qt in quickTimes" 
            :key="qt.time"
            type="button"
            class="chip-time"
            @click="selectTime(qt.time)"
            :class="{ active: props.modelValue.deliveryTime === qt.time }"
          >
            {{ qt.label }}
          </button>
        </div>

        <small v-if="timeError" class="error-msg">
          <i class="fa-solid fa-triangle-exclamation"></i> {{ timeError }}
        </small>
      </div>
      
      <!-- 3. Datos de Envío (Solo Delivery) -->
      <template v-if="isDelivery">
        <div class="form-section-title full-width">
          <i class="fa-solid fa-truck-fast"></i>
          <h3>Datos de Envío / Transporte</h3>
        </div>

        <div class="form-group">
          <label class="required-label">Dirección Escrita</label>
          <input v-model="props.modelValue.deliveryAddress" placeholder="Ciudadela, Calle, Villa..." />
        </div>
        <div class="form-group">
          <label class="required-label">Link Google Maps (Obligatorio)</label>
          <input v-model="props.modelValue.googleMapsLink" placeholder="https://maps.app.goo.gl/..." />
        </div>

        <div class="form-group">
          <label class="required-label">Motorizado o Transporte</label>
          <div class="rider-select-wrapper">
            <select @change="handleRiderChange" :value="props.modelValue.deliveryPerson?.personId || ''">
              <option value="">Seleccione motorizado o transporte...</option>
              <option v-for="rider in riders" :key="rider._id" :value="rider._id">
                {{ rider.name }} ({{ rider.identification }})
              </option>
              <option value="new">+ Agregar nuevo transporte...</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="required-label">Valor de Envío ($)</label>
          <input type="number" v-model.number="props.modelValue.deliveryValue" step="0.01" placeholder="0.00" />
        </div>
      </template>

      <!-- 4. Datos Cliente -->
      <div class="form-group">
        <label class="required-label">Nombre Cliente</label>
        <input v-model="props.modelValue.customerName" required />
      </div>

      <div class="form-group">
        <label class="required-label">Celular</label>
        <input v-model="props.modelValue.customerPhone" required />
      </div>
      
      <!-- Responsable is now automated by backend -->
    </div>

    <!-- Modal para nuevo motorizado -->
    <DeliveryPersonFormModal 
      :is-open="isRiderModalOpen"
      @close="isRiderModalOpen = false"
      @save="handleRiderSave"
    />

    <div class="form-group" style="margin-top: 1.5rem;">
      <label>Notas Especiales (Comentarios)</label>
      <textarea v-model="props.modelValue.comments" rows="3" placeholder="Detalles adicionales del pedido..."></textarea>
    </div>

    <!-- No enviar a producción -->
    <div class="production-skip-toggle">
      <label>
        <input type="checkbox" v-model="props.modelValue.skipProduction" />
        <span class="toggle-text">
          <i class="fa-solid fa-store"></i>
          No enviar a producción (disponible hoy)
        </span>
      </label>
    </div>

    <div v-if="props.modelValue.skipProduction" class="exit-point-fields">
      <h3><i class="fa-solid fa-location-dot"></i> Punto de Salida</h3>
      <p class="exit-point-hint">Indica desde qué local o punto se entregará este postre.</p>
      <div class="radio-group">
        <label v-for="branch in BRANCHES" :key="branch" class="radio-label">
          <input type="radio" v-model="props.modelValue.exitPoint" :value="branch" />
          {{ branch }}
        </label>
      </div>
    </div>

    <div class="invoice-toggle">
      <label>
        <input type="checkbox" v-model="props.modelValue.invoiceNeeded" />
        Requiere Factura
      </label>
    </div>

    <div v-if="props.modelValue.invoiceNeeded" class="invoice-fields">
      <h3>Datos de Facturación</h3>

      <!-- Tipo de persona (obligatorio para facturación SRI correcta) -->
      <!-- Se bloquea automáticamente cuando el RUC/cédula tiene largo válido -->
      <div class="form-group full-inv-width">
        <label class="required-label">
          Tipo de Persona
          <span v-if="personTypeLocked" class="pt-locked-hint">
            <i class="fa-solid fa-lock"></i> Auto-detectado del documento
          </span>
        </label>
        <div class="person-type-selector" :class="{ 'person-type-selector--locked': personTypeLocked }">
          <label
            class="person-type-option"
            :class="{ active: props.modelValue.invoiceData.personType === 'natural', locked: personTypeLocked }"
          >
            <input
              type="radio"
              value="natural"
              v-model="props.modelValue.invoiceData.personType"
              :disabled="personTypeLocked"
            />
            <div class="pt-icon"><i class="fa-solid fa-user"></i></div>
            <div class="pt-text">
              <span class="pt-label">Persona Natural</span>
              <span class="pt-hint">Cédula (10 dígitos) o RUC personal (13 dígitos)</span>
            </div>
          </label>
          <label
            class="person-type-option"
            :class="{ active: props.modelValue.invoiceData.personType === 'juridica', locked: personTypeLocked }"
          >
            <input
              type="radio"
              value="juridica"
              v-model="props.modelValue.invoiceData.personType"
              :disabled="personTypeLocked"
            />
            <div class="pt-icon"><i class="fa-solid fa-building"></i></div>
            <div class="pt-text">
              <span class="pt-label">Persona Jurídica</span>
              <span class="pt-hint">RUC empresa (13 dígitos)</span>
            </div>
          </label>
        </div>
      </div>

      <!-- RUC / Cédula con búsqueda automática -->
      <div class="form-group full-inv-width">
        <label class="required-label">
          {{ props.modelValue.invoiceData.personType === 'juridica' ? 'RUC Empresa' : 'Cédula / RUC' }}
        </label>
        <div class="ruc-input-wrapper" :class="{ 'is-searching': isSearchingPersona, 'is-found': personaSearchStatus === 'found', 'is-not-found': personaSearchStatus === 'not-found' }">
          <input
            v-model="props.modelValue.invoiceData.ruc"
            :placeholder="props.modelValue.invoiceData.personType === 'juridica' ? '13 dígitos (RUC empresa)' : '10 dígitos (cédula) o 13 (RUC)'"
            inputmode="numeric"
            @input="onRucInput"
            :class="{ 'input-error': rucHasError }"
          />
          <span class="ruc-search-icon">
            <i v-if="isSearchingPersona" class="fas fa-circle-notch fa-spin"></i>
            <i v-else-if="personaSearchStatus === 'found'" class="fas fa-check-circle"></i>
            <i v-else-if="personaSearchStatus === 'not-found'" class="fas fa-user-plus"></i>
            <i v-else class="fas fa-search"></i>
          </span>
        </div>

        <!-- Status banner below the input -->
        <Transition name="status-slide">
          <div v-if="isSearchingPersona" class="persona-status-banner searching">
            <i class="fas fa-circle-notch fa-spin"></i>
            Buscando en Contifico…
          </div>
          <div v-else-if="personaSearchStatus === 'found'" class="persona-status-banner found">
            <i class="fas fa-check-circle"></i>
            Cliente encontrado — datos completados automáticamente
          </div>
          <div v-else-if="personaSearchStatus === 'not-found'" class="persona-status-banner not-found">
            <i class="fas fa-user-plus"></i>
            <div>
              <strong>Cliente nuevo</strong> — no está en Contifico todavía.<br />
              <span>Completa los datos abajo y se registrará al generar la factura.</span>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Autofill fields — show skeleton while searching -->
      <div class="form-group" :class="{ 'field-loading': isSearchingPersona }">
        <label>Razón Social / Nombre</label>
        <div v-if="isSearchingPersona" class="skeleton-input"></div>
        <input v-else v-model="props.modelValue.invoiceData.businessName" placeholder="Nombre completo o razón social" :class="{ 'field-autofilled': personaSearchStatus === 'found' }" />
      </div>
      <div class="form-group" :class="{ 'field-loading': isSearchingPersona }">
        <label>Email</label>
        <div v-if="isSearchingPersona" class="skeleton-input"></div>
        <input v-else v-model="props.modelValue.invoiceData.email" type="email" placeholder="correo@ejemplo.com" :class="{ 'field-autofilled': personaSearchStatus === 'found' }" />
      </div>
      <div class="form-group" :class="{ 'field-loading': isSearchingPersona }">
        <label>Dirección</label>
        <div v-if="isSearchingPersona" class="skeleton-input"></div>
        <input v-else v-model="props.modelValue.invoiceData.address" placeholder="Dirección de facturación" :class="{ 'field-autofilled': personaSearchStatus === 'found' }" />
      </div>
    </div>


    <div v-if="props.modelValue.payments && props.modelValue.payments.length > 0" class="invoice-fields">
      <h3>Historial de Pagos</h3>
      <div class="payment-history-list">
        <div v-for="(payment, index) in props.modelValue.payments" :key="index" class="payment-card">
          <div class="payment-header">
            <span class="payment-method">{{ payment.forma_cobro }}</span>
            <span class="payment-date">{{ new Date(payment.fecha).toLocaleDateString() }}</span>
          </div>
          <div class="payment-details">
            <div class="input-wrapper" style="margin-bottom: 0.5rem;">
               <label style="font-size: 0.8rem; display: block; margin-bottom: 2px;">Monto</label>
               <input type="number" v-model.number="payment.monto" step="0.01" class="custom-input" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; width: 100%;" />
            </div>
            <div v-if="payment.reference || payment.numero_comprobante" class="payment-ref">
               Ref: {{ payment.reference || payment.numero_comprobante }}
            </div>
          </div>
          <button type="button" class="btn-delete-payment" @click="props.modelValue.payments.splice(index, 1)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <OrderPaymentSelector 
      v-model="props.modelValue" 
      :branches="BRANCHES"
    />
  </div>
</template>

<style lang="scss" scoped>
.card {
  background: white;
  border-radius: 16px; // More rounded
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); // Softer, deeper shadow
  border: 1px solid $border-light;
  margin-bottom: 2rem;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.06);
  }
}

.section-header {
  border-bottom: 2px solid $gray-50;
  padding-bottom: 1rem;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    font-family: $font-principal;
    font-size: 1.5rem;
    color: $text-dark;
    margin: 0;
    font-weight: 700;
    letter-spacing: -0.5px;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem; // More breathing room

  @media(max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.full-width {
  grid-column: 1 / -1;
}

// ── RUC search input ──────────────────────────────────────────
.ruc-input-wrapper {
  position: relative;

  input {
    width: 100%;
    padding-right: 2.8rem !important;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  &.is-searching input { border-color: #94a3b8; }
  &.is-found input     { border-color: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,0.12); }
  &.is-not-found input { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.12); }

  .ruc-search-icon {
    position: absolute;
    right: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.9rem;
    pointer-events: none;
    transition: color 0.2s;
    color: #94a3b8;
  }

  &.is-searching .ruc-search-icon { color: #6b7280; }
  &.is-found .ruc-search-icon     { color: #16a34a; }
  &.is-not-found .ruc-search-icon { color: #f59e0b; }
}

// ── Status banner ─────────────────────────────────────────────
.persona-status-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin-top: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 0.82rem;
  line-height: 1.4;

  i { margin-top: 0.1rem; flex-shrink: 0; }

  strong { display: block; margin-bottom: 0.1rem; }
  span   { opacity: 0.85; }

  &.searching {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    i { animation: spin 0.8s linear infinite; }
  }

  &.found {
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #bbf7d0;
  }

  &.not-found {
    background: #fffbeb;
    color: #92400e;
    border: 1px solid #fde68a;
  }
}

// ── Transition ────────────────────────────────────────────────
.status-slide-enter-active,
.status-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.25s ease;
  overflow: hidden;
  max-height: 80px;
}
.status-slide-enter-from,
.status-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
  max-height: 0;
}

// ── Skeleton shimmer ──────────────────────────────────────────
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

.skeleton-input {
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 800px 100%;
  animation: shimmer 1.2s infinite;
}

// ── Autofill flash ────────────────────────────────────────────
@keyframes autofill-flash {
  0%   { background-color: #f0fdf4; }
  100% { background-color: transparent; }
}

.field-autofilled {
  animation: autofill-flash 1.2s ease forwards;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;

  label {
    font-size: 0.9rem;
    color: $text-dark;
    font-weight: 600;
    margin-left: 2px;
    letter-spacing: 0.3px;

    &.required-label::after {
      content: " *";
      color: $error;
    }
  }

  .hint {
    font-size: 0.8rem;
    color: $warning;
    margin-top: 0.25rem;
  }

  input,
  select,
  textarea {
    padding: 0.85rem 1rem; // Comfy padding
    border: 1px solid $border-light;
    border-radius: 10px; // Smooth corners
    font-size: 0.95rem;
    font-family: $font-secondary;
    background-color: $gray-50;
    transition: all 0.2s ease;
    color: $text-dark;
    width: 100%;
    box-sizing: border-box;

    &::placeholder {
      color: lighten-color($text-light, 10%);
    }

    &:hover {
      background-color: white;
      border-color: darken-color($border-light, 10%);
    }

    &:focus {
      outline: none;
      background-color: white;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1); // Focus ring
    }

    &:disabled {
      background-color: $gray-100;
      cursor: not-allowed;
      opacity: 0.7;
    }
  }

  textarea {
    resize: vertical;
    min-height: 100px;
  }
}

.read-only-field {
  padding: 0.85rem 1rem;
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.95rem;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  cursor: not-allowed;

  i {
    color: #6366f1;
    font-size: 1rem;
  }
}

.radio-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;

  .radio-label {
    flex: 1;
    min-width: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    cursor: pointer;
    padding: 0.75rem 1rem;
    border: 1px solid $border-light;
    border-radius: 10px;
    background: white;
    transition: all 0.2s ease;
    font-weight: 500;
    color: $text-light;
    user-select: none;

    &:hover {
      background: $gray-50;
    }

    &:has(input:checked) {
      background: rgba($NICOLE-PURPLE, 0.05);
      border-color: $NICOLE-PURPLE;
      color: $NICOLE-PURPLE;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.15);
    }

    input {
      width: auto;
      margin: 0;
      cursor: pointer;
      accent-color: $NICOLE-PURPLE;
    }
  }
}

.delivery-fields {
  background: linear-gradient(to right, #fff5f9, #fff0f7); // Subtle gradient
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid rgba($NICOLE-PURPLE, 0.2);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-top: 0.5rem;

  @media(max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.invoice-toggle {
  margin: 2rem 0 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid $border-light;
  border-radius: 12px;
  transition: all 0.2s;

  &:hover {
    border-color: $NICOLE-PURPLE;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    color: $text-dark;
    width: 100%;

    input[type="checkbox"] {
      width: 1.2rem;
      height: 1.2rem;
      accent-color: $NICOLE-PURPLE;
      cursor: pointer;
    }
  }
}


.invoice-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 1.5rem;
  background: $gray-50;
  border-radius: 0 0 12px 12px;
  margin-top: -1rem; // Connect with toggle
  margin-bottom: 2rem;
  border: 1px solid $border-light;
  border-top: none;

  @media(max-width: 768px) {
    grid-template-columns: 1fr;
  }

  h3 {
    grid-column: 1 / -1;
    font-size: 1.1rem;
    color: $text-dark;
    margin: 0 0 0.5rem 0;
    font-weight: 700;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.input-wrapper {
  position: relative;

  .custom-input {
    width: 100%;
    // Remove browser default appearance where possible
    appearance: none;
    -webkit-appearance: none;
    position: relative;
    z-index: 2;
    background: transparent;

    // For date/time inputs specifically
    &[type="date"],
    &[type="time"] {
      &::-webkit-calendar-picker-indicator {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0; // Hide the default icon but keep it clickable
        width: 100%;
        height: 100%;
        cursor: pointer;
        z-index: 3;
      }
    }

    // Custom Select Styles
    &.custom-select {
      cursor: pointer;
      padding-right: 2.5rem; // Space for arrow
    }
  }

  .icon-placeholder {
    position: absolute;
    right: 2.5rem; // Move left of arrow
    top: 50%;
    transform: translateY(-50%);
    color: $text-light;
    z-index: 1;
    pointer-events: none;
    font-size: 1.1rem;
    opacity: 0.7;
  }

  .icon-arrow {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: $text-light;
    pointer-events: none;
    font-size: 0.8rem;
    z-index: 1;
  }
}

.quick-times {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;

  .chip-time {
    background: white;
    border: 1px solid $border-light;
    border-radius: 20px; // Pill shape
    padding: 0.35rem 0.85rem;
    font-size: 0.85rem;
    color: $text-light;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
    font-family: $font-secondary;

    &:hover {
      background: $gray-50;
      color: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
    }

    &.active {
      background: rgba($NICOLE-PURPLE, 0.1);
      color: $NICOLE-PURPLE;
      border-color: $NICOLE-PURPLE;
      font-weight: 700;
    }
  }
}

.error-msg {
  color: $error;
  font-size: 0.8rem;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  animation: fadeIn 0.2s ease;
  font-weight: 600;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.payment-history-list {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .payment-card {
    background: white;
    border: 1px solid $border-light;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    transition: all 0.2s;

    &:hover {
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .payment-header {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 120px;

      .payment-method {
        font-weight: 700;
        color: $text-dark;
        font-size: 0.9rem;
      }

      .payment-date {
        font-size: 0.8rem;
        color: $text-light;
      }
    }

    .payment-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .payment-ref {
        font-size: 0.8rem;
        color: $text-light;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .btn-delete-payment {
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 6px;
      transition: background 0.2s;

      &:hover {
        background: #fee2e2;
      }
    }
  }
}

.production-skip-toggle {
  margin: 2rem 0 0;
  padding: 1rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  transition: all 0.2s;

  &:hover {
    border-color: #f59e0b;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    width: 100%;

    input[type="checkbox"] {
      width: 1.2rem;
      height: 1.2rem;
      accent-color: #d97706;
      cursor: pointer;
    }

    .toggle-text {
      font-weight: 600;
      font-size: 1rem;
      color: #92400e;
      display: flex;
      align-items: center;
      gap: 0.5rem;

      i {
        color: #d97706;
      }
    }
  }
}

.exit-point-fields {
  padding: 1.5rem;
  background: #fef3c7;
  border-radius: 0 0 12px 12px;
  margin-top: -1rem;
  border: 1px solid #fde68a;
  border-top: none;
  margin-bottom: 2rem;
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  h3 {
    font-size: 1rem;
    font-weight: 700;
    color: #92400e;
    margin: 0 0 0.25rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    i {
      color: #d97706;
    }
  }

  .exit-point-hint {
    font-size: 0.85rem;
    color: #b45309;
    margin: 0 0 1rem 0;
  }

  .radio-group .radio-label {
    &:has(input:checked) {
      background: rgba(#d97706, 0.1);
      border-color: #d97706;
      color: #92400e;
      box-shadow: 0 4px 12px rgba(#d97706, 0.15);
    }

    input {
      accent-color: #d97706;
    }
  }
}

// Selector de tipo de persona para facturación
.full-inv-width {
  grid-column: 1 / -1;
}

.person-type-selector {
  display: flex;
  gap: 0.75rem;

  @media(max-width: 600px) {
    flex-direction: column;
  }

  .person-type-option {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border: 2px solid $border-light;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    background: white;

    input[type="radio"] {
      display: none;
    }

    &:hover {
      border-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.02);
    }

    &.active {
      border-color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.05);
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
    }

    .pt-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba($NICOLE-PURPLE, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: $NICOLE-PURPLE;
      font-size: 1rem;
      flex-shrink: 0;
    }

    .pt-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;

      .pt-label {
        font-weight: 700;
        font-size: 0.9rem;
        color: #1e293b;
      }

      .pt-hint {
        font-size: 0.72rem;
        color: #94a3b8;
        line-height: 1.3;
      }
    }

    // Estado bloqueado: opacidad reducida en la opción NO seleccionada, cursor deshabilitado
    &.locked {
      cursor: default;
      pointer-events: none;

      &:not(.active) {
        opacity: 0.35;
        filter: grayscale(0.5);
      }

      &.active {
        border-color: #059669;
        background: rgba(5, 150, 105, 0.06);
        box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);

        .pt-icon {
          background: rgba(5, 150, 105, 0.12);
          color: #059669;
        }
      }
    }
  }

  // Contenedor bloqueado — quita el hover del wrapper
  &--locked {
    cursor: default;
  }
}

// Hint "auto-detectado del documento"
.pt-locked-hint {
  font-size: 0.7rem;
  font-weight: 600;
  color: #059669;
  margin-left: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  opacity: 0.9;
}

// Borde rojo sutil cuando el RUC/cédula tiene largo incorrecto
:deep(.input-error) {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12) !important;
}
</style>
