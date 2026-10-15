<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ProductionService from '@/services/production.service'
import ProductionSettingsService, { type ProductionDestination } from '@/services/production-settings.service'
import { parseECTDate, getECTNow, isSameDayECT } from '@/utils/dateUtils'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import DestinationDeleteModal from './DestinationDeleteModal.vue'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'success', 'settings-updated'])

const router = useRouter()
const step = ref<1 | 2 | 3>(1)
const selectedDestination = ref('')
const isLoading = ref(false)
const rawOrders = ref<any[]>([])
const items = ref<{ name: string; pending: number; unproduced: number; toSend: number }[]>([])
const filterMode = ref<'today' | 'tomorrow' | 'all'>('today')
const showUnproducedConfirm = ref(false)

const destinations = ref<ProductionDestination[]>([])
const toast = useToast()
const dialog = useDialog()
const isManager = computed(() => {
  const userInfoStr = localStorage.getItem('user_info')
  if (!userInfoStr) return false
  const user = JSON.parse(userInfoStr)
  const role = user.role?.toUpperCase() || ''
  // Allow ADMIN, SALES_MANAGER, and PRODUCTION to configure destinations
  return role === 'SALES_MANAGER' || role === 'ADMIN' || role === 'PRODUCTION'
})

// Removed old destinations static array

const calculatePendingItems = () => {
  if (!rawOrders.value.length) return Promise.resolve()

  const agg: Record<string, { produced: number; unproduced: number }> = {}
  const ecNow = getECTNow()
  const today = new Date(ecNow.getFullYear(), ecNow.getMonth(), ecNow.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  rawOrders.value.forEach((o: any) => {
    // 1. Filter by Destination
    let destMatch = false
    const destConfig = destinations.value.find(d => d.name === selectedDestination.value)

    if (destConfig) {
      if (destConfig.name === 'Domicilio / Delivery' && o.deliveryType === 'delivery') {
        destMatch = true
      } else {
        const branch = (o.branch || '').toLowerCase().trim()
        const destNameLower = destConfig.name.toLowerCase().trim()
        // Match by name first (branch contains dest name, or is equal)
        const nameMatch = branch === destNameLower || branch.includes(destNameLower)
        // Then match by configured keywords
        const keywordMatch = destConfig.matchKeywords.some(keyword => {
          const kw = keyword.toLowerCase().trim()
          return kw && branch.includes(kw)
        })
        destMatch = nameMatch || keywordMatch
      }
    }

    if (!destMatch) return

    // 2. Filter by Date — use ECT-aware parsing to avoid off-by-one with UTC midnight dates
    if (!o.deliveryDate) return
    const dDate = parseECTDate(o.deliveryDate)
    let dateMatch = false
    if (filterMode.value === 'all') dateMatch = true
    else if (filterMode.value === 'today') dateMatch = isSameDayECT(dDate, today)
    else if (filterMode.value === 'tomorrow') dateMatch = isSameDayECT(dDate, tomorrow)

    if (!dateMatch) return

    // 3. Filter Active Orders
    if (o.dispatchStatus === 'SENT') return

    // 4. Aggregate Products
    o.products.forEach((p: any) => {
      let sentSum = 0
      if (o.dispatches) {
        o.dispatches.forEach((d: any) => {
          d.items.forEach((i: any) => {
            const isMatch = (p._id && i.productId && i.productId === p._id) || (i.name === p.name)
            if (isMatch) sentSum += i.quantitySent
          })
        })
      }

      const produced = p.produced || 0
      const quantity = p.quantity || 0
      const producedAvailable = Math.max(0, produced - sentSum)  // Produced, not yet sent
      const totalRemaining = Math.max(0, quantity - sentSum)      // Total still pending
      const unproducedQty = Math.max(0, totalRemaining - producedAvailable) // Ordered but not produced

      if (totalRemaining > 0) {
        if (!agg[p.name]) {
          agg[p.name] = { produced: 0, unproduced: 0 }
        }

        const currentAgg = agg[p.name]!
        currentAgg.produced += producedAvailable
        currentAgg.unproduced += unproducedQty
      }
    })
  })

  // Convert to Array
  const resultItems: { name: string; pending: number; unproduced: number; toSend: number }[] = Object.entries(agg).map(([name, data]) => ({
    name,
    pending: data.produced,
    unproduced: data.unproduced,
    toSend: data.produced // Default: send what's ready
  }))

  items.value = resultItems.sort((a, b) => b.pending - a.pending)
}

const fetchPendingItems = async () => {
  if (!selectedDestination.value) return

  try {
    isLoading.value = true
    const orders = await ProductionService.getAllOrders('all')
    rawOrders.value = orders
    calculatePendingItems()
    step.value = 2
  } catch (e) {
    console.error(e)
    await dialog.alert('Error cargando ítems pendientes.', { variant: 'error', title: 'Error' })
  } finally {
    isLoading.value = false
  }
}

const handleDestinationSelect = (dest: string) => {
  selectedDestination.value = dest
  filterMode.value = 'today' // Reset to today by default
  fetchPendingItems()
}

// Re-calculate when filter changes
watch(filterMode, () => {
  calculatePendingItems()
})

const errorMessage = ref('')

const totalUnproduced = computed(() => items.value.reduce((acc, i) => acc + i.unproduced, 0))
const hasPendingProduction = computed(() => totalUnproduced.value > 0)
const sendingUnproduced = computed(() => items.value.some(i => i.toSend > i.pending))

const goToProduction = () => {
  emit('close')
  router.push({ name: 'production-summary' })
}

const handleConfirm = async () => {
  errorMessage.value = ''
  const payloadItems = items.value
    .filter(i => i.toSend > 0)
    .map(i => ({ name: i.name, quantity: i.toSend }))

  if (payloadItems.length === 0) {
    errorMessage.value = 'Ingresa una cantidad a enviar.'
    return
  }

  // If sending unproduced items, ask for confirmation first
  if (sendingUnproduced.value && !showUnproducedConfirm.value) {
    showUnproducedConfirm.value = true
    return
  }

  showUnproducedConfirm.value = false

  try {
    isLoading.value = true
    await ProductionService.registerDispatchProgress(selectedDestination.value, payloadItems)
    emit('success')
    emit('close')
  } catch (e) {
    console.error(e)
    errorMessage.value = 'Error al registrar el envío. Por favor intenta de nuevo.'
  } finally {
    isLoading.value = false
  }
}

const reset = () => {
  step.value = 1
  selectedDestination.value = ''
  items.value = []
  errorMessage.value = ''
  showUnproducedConfirm.value = false
}

const fetchDestinations = async () => {
  try {
    const settings = await ProductionSettingsService.getSettings()
    if (settings && settings.destinations) {
      destinations.value = settings.destinations
    }
  } catch (e) {
    console.error('Error fetching destinations:', e)
  }
}

// Config editor logic
const editableDestinations = ref<ProductionDestination[]>([])
const originalDestinations = ref<ProductionDestination[]>([])
const isSavingConfig = ref(false)

const hasUnsavedChanges = computed(() => {
  return JSON.stringify(editableDestinations.value) !== JSON.stringify(originalDestinations.value)
})

// Delete Modal State
const showDeleteModal = ref(false)
const destinationToDelete = ref<ProductionDestination | null>(null)

const openDeleteModal = (dest: ProductionDestination) => {
  destinationToDelete.value = dest
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  if (destinationToDelete.value) {
    const idx = editableDestinations.value.findIndex(d => d.id === destinationToDelete.value?.id)
    if (idx !== -1) {
      editableDestinations.value.splice(idx, 1)
      await saveConfig(true)
    }
  }
  showDeleteModal.value = false
  destinationToDelete.value = null
}

const openConfig = () => {
  // Deep clone current setup to edit safely
  editableDestinations.value = JSON.parse(JSON.stringify(destinations.value))
  originalDestinations.value = JSON.parse(JSON.stringify(destinations.value))
  step.value = 3
}

const addDestinationConfig = () => {
  const newId = `dest-${Date.now()}`
  editableDestinations.value.push({
    id: newId,
    name: 'Nuevo Destino',
    icon: 'fas fa-store',
    matchKeywords: []
  })
}

const removeDestinationConfig = (index: number) => {
  editableDestinations.value.splice(index, 1)
}

// --- Hold-to-Delete Logic removed ---


const addKeyword = (dest: ProductionDestination, event: Event) => {
  const input = event.target as HTMLInputElement
  const value = input.value.trim()
  if (value) {
    if (!dest.matchKeywords) dest.matchKeywords = []
    // Prevent duplicates
    if (!dest.matchKeywords.includes(value.toLowerCase())) {
      dest.matchKeywords.push(value.toLowerCase())
    }
    input.value = ''
  }
}

const removeKeyword = (dest: ProductionDestination, keywordIndex: number) => {
  dest.matchKeywords.splice(keywordIndex, 1)
}

const saveConfig = async (isAutoDelete = false) => {
  // Removed empty check to allow clearing all destinations

  // Validate empty names
  const hasEmptyNames = editableDestinations.value.some(d => !d.name.trim())
  if (hasEmptyNames) {
    if (!isAutoDelete) toast.info('Todos los destinos deben tener un nombre.')
    return
  }

  try {
    isSavingConfig.value = true
    const response = await ProductionSettingsService.updateSettings({ destinations: editableDestinations.value })

    if (response) {
      destinations.value = response.destinations
      originalDestinations.value = JSON.parse(JSON.stringify(destinations.value))

      if (isAutoDelete) {
        toast.info('Cambios guardados automáticamente.')
      } else {
        toast.info('Configuración guardada satisfactoriamente.')
      }
      emit('settings-updated')
    }
  } catch (e) {
    console.error('Error saving config:', e)
  } finally {
    isSavingConfig.value = false
  }
}



// Common icons for destinations
const availableIcons = [
  { class: 'fas fa-store', label: 'Tienda' },
  { class: 'fas fa-store-alt', label: 'Tienda Alternativa' },
  { class: 'fas fa-shopping-bag', label: 'Centro Comercial' },
  { class: 'fas fa-shopping-cart', label: 'Carrito' },
  { class: 'fas fa-industry', label: 'Fábrica / Centro' },
  { class: 'fas fa-motorcycle', label: 'Delivery' },
  { class: 'fas fa-truck', label: 'Camión' },
  { class: 'fas fa-map-marker-alt', label: 'Ubicación' },
  { class: 'fas fa-building', label: 'Edificio' },
  { class: 'fas fa-home', label: 'Casa' },
  { class: 'fas fa-utensils', label: 'Restaurante' },
  { class: 'fas fa-coffee', label: 'Cafetería' }
]

const iconOptions = computed(() => availableIcons.map(icon => ({
  value: icon.class,
  label: icon.label,
  icon: icon.class
})))

// Reset state when modal is opened
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    reset()
    fetchDestinations()
    showDeleteModal.value = false
    destinationToDelete.value = null
  }
})
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="isOpen" class="modal-overlay" @click="$emit('close')">
      <div class="modal-content" @click.stop>
        
        <Transition name="slide-fade" mode="out-in">
          <!-- STEP 1: DESTINATION -->
          <div v-if="step === 1" class="step-container" key="step1">
            <header>
              <h2>Selecciona Destino</h2>
          <div class="header-actions">
            <button v-if="isManager" class="btn-config" @click="openConfig">
              <i class="fas fa-cog"></i> Administrar Destinos
            </button>
            <button class="btn-close" @click="$emit('close')">&times;</button>
          </div>
        </header>

        <div v-if="destinations.length === 0" class="empty-destinations">
           <i class="fas fa-map-marker-alt icon-empty"></i>
           <p>No hay lugares de despacho configurados.</p>
           <button v-if="isManager" class="btn-primary" @click="openConfig">
              <i class="fas fa-plus"></i> Configurar Lugares
           </button>
           <p v-else class="text-muted">Contacta a un administrador para configurar los destinos.</p>
        </div>
        <div v-else class="dest-grid">
            <button 
                v-for="dest in destinations" 
                :key="dest.id"
                class="btn-dest"
                @click="handleDestinationSelect(dest.name)"
            >
                <i :class="dest.icon"></i>
                <span>{{ dest.name }}</span>
            </button>
        </div>
      </div>

      <!-- STEP 2: ITEMS -->
      <div v-else-if="step === 2" class="step-container" key="step2">
        <header>
            <button class="btn-back" @click="reset"><i class="fas fa-arrow-left"></i></button>
            <div class="title-col">
                <div class="dest-title">
                    <h2>{{ selectedDestination }}</h2>
                </div>
            </div>
            <button class="btn-close" @click="$emit('close')">&times;</button>
        </header>

        <div v-if="errorMessage" class="error-banner">
          <i class="fas fa-exclamation-circle"></i> {{ errorMessage }}
        </div>
        
        <!-- Date Filters -->
        <div class="filter-tabs">
            <button :class="{ active: filterMode === 'today' }" @click="filterMode = 'today'">Hoy</button>
            <button :class="{ active: filterMode === 'tomorrow' }" @click="filterMode = 'tomorrow'">Mañana</button>
            <button :class="{ active: filterMode === 'all' }" @click="filterMode = 'all'">Todos</button>
        </div>

        <div v-if="isLoading" class="loading">Cargando...</div>

        <div v-else-if="showUnproducedConfirm" class="unproduced-confirm">
          <div class="confirm-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <h3>¿Enviar sin marcar producción?</h3>
          <p>
            Estás a punto de registrar ítems que <strong>no han sido marcados como producidos</strong>.
            Esto omitirá el registro de producción y podría causar inconsistencias en el inventario.
          </p>
          <div class="confirm-actions">
            <button class="btn-cancel-confirm" @click="showUnproducedConfirm = false">
              <i class="fas fa-arrow-left"></i> Volver y revisar
            </button>
            <button class="btn-force-send" @click="handleConfirm">
              <i class="fas fa-paper-plane"></i> Sí, enviar de todas formas
            </button>
          </div>
        </div>

        <div v-else class="items-list">
          <!-- Alert: items pending production -->
          <div v-if="hasPendingProduction" class="production-alert">
            <div class="alert-top">
              <i class="fas fa-exclamation-triangle"></i>
              <span>
                <strong>{{ totalUnproduced }} unidad(es)</strong> aún no han sido marcadas como producidas.
              </span>
            </div>
            <div class="alert-actions">
              <small>Puedes ir a producción a marcarlas primero, o incluirlas de todas formas al enviar.</small>
              <button class="btn-go-production" @click="goToProduction">
                <i class="fas fa-industry"></i> Ir a Producción
              </button>
            </div>
          </div>

          <div class="list-header" :class="hasPendingProduction ? 'cols-4' : 'cols-3'">
            <span>Producto</span>
            <span title="Producido y listo para enviar">Producido</span>
            <span title="Pedido pero no marcado como producido" v-if="hasPendingProduction" class="col-unproduced">Sin prod.</span>
            <span>A Enviar</span>
          </div>

          <div
            class="item-row"
            :class="[
              { 'row-unproduced': item.unproduced > 0 && item.pending === 0, 'row-partial': item.unproduced > 0 && item.pending > 0 },
              hasPendingProduction ? 'cols-4' : 'cols-3'
            ]"
            v-for="item in items"
            :key="item.name"
          >
            <div class="prod-name">
              {{ item.name }}
              <span v-if="item.unproduced > 0" class="unproduced-badge" title="Tiene unidades sin producir">
                <i class="fas fa-clock"></i>
              </span>
            </div>
            <div class="prod-pending" :class="{ 'zero': item.pending === 0 }">{{ item.pending }}</div>
            <div class="prod-unproduced" v-if="hasPendingProduction">{{ item.unproduced > 0 ? item.unproduced : '-' }}</div>
            <div class="prod-input">
              <input
                type="number"
                v-model.number="item.toSend"
                min="0"
                :max="item.pending + item.unproduced"
                :class="{ 'input-over': item.toSend > item.pending }"
              >
              <button @click="item.toSend = item.pending + item.unproduced" class="btn-max" title="Enviar Todo (incluye sin producir)">
                <i class="fas fa-check-double"></i>
              </button>
            </div>
          </div>

          <div v-if="items.length === 0" class="empty">
            <p>No hay ítems pendientes de envío para <strong>{{ filterMode === 'today' ? 'HOY' : filterMode === 'tomorrow' ? 'MAÑANA' : 'esta selección' }}</strong>.</p>
          </div>
        </div>

        <div class="actions" v-if="!showUnproducedConfirm">
          <button class="btn-confirm" @click="handleConfirm" :disabled="items.length === 0 || items.every(i => i.toSend === 0)">
            <i class="fas fa-paper-plane"></i> Registrar Envío
          </button>
        </div>
      </div>

      <!-- STEP 3: EDITOR (Admin Only) -->
      <div v-else-if="step === 3 && isManager" class="editor-step step-container" key="step3">
        <header>
            <button class="btn-back" @click="step = 1"><i class="fas fa-arrow-left"></i></button>
            <h2>Administrar Destinos</h2>
            <button class="btn-close" @click="$emit('close')">&times;</button>
        </header>

        <div v-if="errorMessage" class="error-banner">
          <i class="fas fa-exclamation-circle"></i> {{ errorMessage }}
        </div>
        
        <div class="editor-list">
          <!-- Empty State in Editor -->
          <div v-if="editableDestinations.length === 0" class="editor-empty-state">
             <div class="empty-icon-wrap">
                <i class="fa-solid fa-map-location-dot"></i>
             </div>
             <h3>Aún no tienes destinos configurados</h3>
             <p>Comienza añadiendo los lugares a donde enviarás producción todos los días. Ej: Tienda principal, Isla, etc.</p>
          </div>

          <TransitionGroup name="list" tag="div" class="list-wrapper">
            <div 
              v-for="(dest, index) in editableDestinations" 
              :key="dest.id" 
              class="editor-row"
            >
              <div class="editor-fields">
                <div class="form-group">
                  <label>Nombre del Destino</label>
                  <input type="text" v-model="dest.name" placeholder="Ej: San Marino" />
                </div>
                <div class="form-group icon-selector-group">
                  <label>Icono Visual</label>
                <SearchableSelect
                  v-model="dest.icon"
                  :options="iconOptions"
                  placeholder="Seleccionar ícono..."
                  searchPlaceholder="Buscar ícono..."
                >
                  <template #icon>
                    <i :class="dest.icon || 'fas fa-map-marker-alt'" style="color: #812a73; font-size: 1.1rem; width: 22px; text-align: center;"></i>
                  </template>
                </SearchableSelect>
              </div>
                <div class="form-group keywords-group">
                  <label>Palabras Clave asociadas a la Sucursal</label>
                  <div class="tag-input-container">
                    <div class="tags-list">
                      <TransitionGroup name="tag-fade">
                        <span 
                          v-for="(kw, kId) in dest.matchKeywords" 
                          :key="kId + kw" 
                          class="keyword-tag"
                        >
                          {{ kw }}
                          <button class="btn-remove-tag" @click="removeKeyword(dest, kId)" title="Quitar palabra">
                            <i class="fas fa-times"></i>
                          </button>
                        </span>
                      </TransitionGroup>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Escribe una palabra y presiona Enter..." 
                      @keydown.enter.prevent="addKeyword(dest, $event)"
                      @blur="addKeyword(dest, $event)"
                    />
                  </div>
                  <small>Buscará si la "Sucursal" del pedido contiene alguna de estas palabras. Se aplicará a todas como cuadros visuales.</small>
                </div>
              </div>
              
              <button class="btn-remove-dest" @click="openDeleteModal(dest)" title="Eliminar Destino">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </TransitionGroup>
        </div>

        <div class="editor-actions-bottom">
          <button class="btn-add-dest" @click="addDestinationConfig">
            <i class="fas fa-plus"></i> Añadir Nuevo Destino
          </button>

          <button 
            class="btn-save-config" 
            :class="{ 'has-changes': hasUnsavedChanges }"
            @click="saveConfig(false)" 
            :disabled="isSavingConfig"
          >
              <i class="fas fa-save" v-if="!isSavingConfig"></i>
              <i class="fas fa-spinner fa-spin" v-else></i>
              {{ isSavingConfig ? 'Guardando...' : (hasUnsavedChanges ? '¡Guardar Cambios!' : 'Configuración Guardada') }}
          </button>
        </div>
      </div>
      </Transition>

    </div>
  </div>
  </Transition>

  <!-- DELETE MODAL INTEGRATION -->
  <DestinationDeleteModal
    :is-open="showDeleteModal"
    :destination-name="destinationToDelete?.name || ''"
    @close="showDeleteModal = false"
    @confirm="confirmDelete"
  />
</template>

<style lang="scss" scoped>
$font-stack: 'Inter', system-ui, sans-serif;

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: $white;
  width: 90%;
  max-width: 500px;
  border-radius: 16px;
  padding: 1.5rem;
  font-family: $font-stack;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  height: 80vh;
  display: flex;
  flex-direction: column;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;

  h2 {
    margin: 0;
    font-size: 1.2rem;
    color: $text-dark;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .btn-config {
    background: $warning;
    color: $white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &:hover {
      background: $warning-dark;
    }
  }

  .btn-close {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: $gray-400;
  }

  .btn-back {
    background: transparent;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: $text-dark;
    margin-right: 1rem;
  }
}

.empty-destinations {
  padding: 3rem 1rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: $gray-50;
  border-radius: 12px;
  border: 2px dashed $border-light;

  .icon-empty {
    font-size: 3rem;
    color: $gray-400;
  }

  p {
    color: $gray-600;
    margin: 0;
    font-weight: 500;
  }

  .text-muted {
    font-size: 0.85rem;
    color: $gray-500;
  }

  .btn-primary {
    background: $NICOLE-PURPLE;
    color: $white;
    border: none;
    padding: 0.8rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;

    &:hover {
      background: $purple-dark;
      transform: translateY(-2px);
    }
  }
}

.filter-tabs {
  display: flex;
  background: $gray-100;
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 1rem;

  button {
    flex: 1;
    border: none;
    background: transparent;
    padding: 6px;
    border-radius: 6px;
    font-weight: 600;
    color: $gray-600;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;

    &.active {
      background: $white;
      color: $text-dark;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
  }
}

.dest-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  .btn-dest {
    background: $gray-50;
    border: 2px solid transparent;
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;

    i {
      font-size: 1.8rem;
      color: $text-dark;
    }

    span {
      font-weight: 600;
      color: $text-dark;
      font-size: 0.9rem;
    }

    &:hover {
      background: $purple-overlay;
      border-color: $NICOLE-PURPLE;

      i {
        color: $NICOLE-PURPLE;
      }
    }
  }
}

.items-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 1rem;
  border-top: 1px solid $border-light;

  .list-header {
    display: grid;
    grid-template-columns: 2fr 1fr 1.5fr;
    padding: 0.8rem 0;
    font-size: 0.75rem;
    font-weight: 700;
    color: $gray-500;
    text-transform: uppercase;
    border-bottom: 1px solid $border-light;
    position: sticky;
    top: 0;
    background: $white;

    &.cols-4 {
      grid-template-columns: 2fr 1fr 1fr 1.5fr;
    }

    &.cols-3 {
      grid-template-columns: 2fr 1fr 1.5fr;
    }
  }

  .item-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1.5fr;
    padding: 0.8rem 0;
    align-items: center;
    border-bottom: 1px solid $gray-50;

    &.cols-4 {
      grid-template-columns: 2fr 1fr 1fr 1.5fr;
    }

    &.cols-3 {
      grid-template-columns: 2fr 1fr 1.5fr;
    }

    .prod-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: $text-dark;
    }

    .prod-pending {
      color: $warning;
      font-weight: 700;
      text-align: center;
    }

    .prod-input {
      display: flex;
      align-items: center;
      gap: 4px;

      .btn-max {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: $purple-overlay;
        border: 1px solid $border-light;
        border-radius: 6px;
        cursor: pointer;
        color: $NICOLE-PURPLE;
        transition: all 0.2s;

        &:hover {
          background: $NICOLE-PURPLE;
          color: $white;
        }

        i {
          font-size: 0.8rem;
        }
      }

      input {
        width: 100%;
        padding: 6px;
        border: 1px solid $border-light;
        border-radius: 6px;
        text-align: center;
        font-weight: 700;
        color: $success;
        font-size: 1rem;
        background: $white;

        &:focus {
          outline: none;
          border-color: $success;
        }
      }
    }
  }
}

.actions {
  .btn-confirm {
    width: 100%;
    padding: 1rem;
    background: $success;
    color: $white;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: $success-dark;
      transform: translateY(-1px);
    }

    &:disabled {
      background: $gray-400;
      cursor: not-allowed;
    }
  }
}

.production-alert {
  background: #fff8e1;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 0.8rem 1rem;
  margin-bottom: 0.8rem;
  font-size: 0.85rem;

  .alert-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #92400e;
    font-weight: 600;

    i {
      color: #f59e0b;
    }
  }

  .alert-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.5rem;
    gap: 0.5rem;

    small {
      color: #78350f;
      font-size: 0.78rem;
      flex: 1;
    }
  }

  .btn-go-production {
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.4rem;

    &:hover {
      background: #d97706;
    }
  }
}

.col-unproduced {
  color: #f59e0b;
}

.row-unproduced {
  background: #fff8e1;
  border-left: 3px solid #f59e0b;

  .prod-name {
    color: #92400e;
  }
}

.row-partial {
  border-left: 3px solid #f59e0b;
}

.unproduced-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 0.3rem;
  color: #f59e0b;
  font-size: 0.75rem;
}

.prod-unproduced {
  color: #f59e0b;
  font-weight: 700;
  text-align: center;
}

.prod-pending.zero {
  color: $gray-400;
}

.input-over {
  border-color: #f59e0b !important;
  color: #92400e !important;
  background: #fff8e1 !important;
}

.unproduced-confirm {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  gap: 1rem;

  .confirm-icon {
    width: 60px;
    height: 60px;
    background: #fff8e1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    i {
      font-size: 1.8rem;
      color: #f59e0b;
    }
  }

  h3 {
    margin: 0;
    font-size: 1.1rem;
    color: $text-dark;
  }

  p {
    color: $gray-600;
    font-size: 0.9rem;
    line-height: 1.5;
    max-width: 340px;
    margin: 0;
  }

  .confirm-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 340px;

    .btn-cancel-confirm {
      background: $gray-100;
      color: $text-dark;
      border: 1px solid $border-light;
      border-radius: 8px;
      padding: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;

      &:hover {
        background: $gray-200;
      }
    }

    .btn-force-send {
      background: #f59e0b;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;

      &:hover {
        background: #d97706;
      }
    }
  }
}

.empty {
  padding: 2rem;
  text-align: center;
  color: $gray-500;
  font-size: 0.9rem;
}

// Editor styles
.editor-step {
  flex: 1;
  display: flex;
  flex-direction: column;

  .editor-list {
    flex: 1;
    overflow-y: visible;
    /* To allow SearchableSelect dropdown to pop out */
    padding-right: 0.5rem;
    padding-bottom: 3rem;
    /* Extra space at bottom to scroll past dropdowns */
    margin-bottom: 1rem;

    /* Create custom scrollbar just in case inner container still needs to scroll */
    max-height: calc(80vh - 200px);
    overflow-y: auto;

    .editor-row {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      background: $gray-50;
      padding: 1.5rem;
      border-radius: 12px;
      border: 1px solid $border-light;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
      transition: all 0.3s ease;

      &:hover {
        border-color: $NICOLE-PURPLE;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }

      .editor-fields {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;

          label {
            font-size: 0.8rem;
            font-weight: 600;
            color: $gray-600;
          }

          input {
            padding: 0.6rem;
            border: 1px solid $border-light;
            border-radius: 6px;
            font-size: 0.9rem;
            color: $text-dark;
            width: 100%;
            background: $white;

            &:focus {
              outline: none;
              border-color: $NICOLE-PURPLE;
              box-shadow: 0 0 0 2px $purple-overlay;
            }
          }
        }

        .keywords-group {
          .tag-input-container {
            display: flex;
            flex-direction: column;
            border: 1px solid $border-light;
            border-radius: 8px;
            background: $white;
            padding: 0.5rem;
            transition: border-color 0.2s;

            &:focus-within {
              border-color: $NICOLE-PURPLE;
              box-shadow: 0 0 0 2px $purple-overlay;
            }

            .tags-list {
              display: flex;
              flex-wrap: wrap;
              gap: 0.5rem;
              margin-bottom: 0.5rem;

              .keyword-tag {
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
                background: rgba($NICOLE-PURPLE, 0.08);
                color: $NICOLE-PURPLE;
                padding: 0.35rem 0.6rem;
                border-radius: 6px;
                font-size: 0.85rem;
                font-weight: 500;
                border: 1px solid rgba($NICOLE-PURPLE, 0.2);

                .btn-remove-tag {
                  background: transparent;
                  border: none;
                  color: $NICOLE-PURPLE;
                  cursor: pointer;
                  padding: 0;
                  margin: 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 0.8rem;
                  opacity: 0.6;
                  transition: opacity 0.2s;

                  &:hover {
                    opacity: 1;
                    color: $error;
                  }
                }
              }
            }

            input {
              border: none;
              padding: 0.2rem 0.4rem;
              width: 100%;
              font-size: 0.9rem;
              background: transparent;
              box-shadow: none;

              &:focus {
                outline: none;
                box-shadow: none;
              }
            }
          }
        }

        small {
          font-size: 0.75rem;
          color: $gray-500;
        }
      }
    }

  }

  .btn-remove-dest {
    background: transparent;
    color: $gray-400;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    font-size: 1.2rem;
    border-radius: 6px;
    transition: all 0.2s;

    &:hover {
      color: $error;
      background: rgba($error, 0.1);
    }
  }
}

.editor-actions-bottom {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid $border-light;
  background: white;
  margin-top: auto;

  .btn-add-dest {
    background: transparent;
    color: $NICOLE-PURPLE;
    border: 2px dashed $border-light;
    padding: 1rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

    &:hover {
      background: $purple-overlay;
      border-color: $NICOLE-PURPLE;
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }
  }

  .btn-save-config {
    width: 100%;
    padding: 1rem;
    background: $NICOLE-PURPLE;
    color: $white;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s;

    &:disabled:not(.has-changes) {
      background: $gray-400;
      cursor: not-allowed;
    }

    &.has-changes {
      background: $success;
      animation: gentle-pulse 2s infinite;

      &:hover {
        background: $success-dark;
      }
    }
  }
}

@keyframes gentle-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba($success, 0.4);
  }

  70% {
    box-shadow: 0 0 0 10px rgba($success, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba($success, 0);
  }
}

.editor-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 1.5rem;
  background: #fdfaff;
  border: 2px dashed rgba($NICOLE-PURPLE, 0.2);
  border-radius: 16px;
  margin-top: 1rem;

  .empty-icon-wrap {
    width: 70px;
    height: 70px;
    background: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 2rem;
    margin-bottom: 1.2rem;
  }

  h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.15rem;
    color: $text-dark;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    color: $gray-500;
    line-height: 1.5;
    max-width: 90%;
  }
}

// Transitions
.tag-fade-enter-active,
.tag-fade-leave-active {
  transition: all 0.25s ease;
}

.tag-fade-enter-from,
.tag-fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from {
  transform: translateX(10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(-10px);
  opacity: 0;
}

@keyframes vanish {
  0% {
    transform: scale(1) rotate(0deg);
    filter: blur(2px) grayscale(1);
    opacity: 0.7;
  }

  20% {
    transform: scale(1.05) rotate(2deg);
    filter: blur(4px) grayscale(1) brightness(1.5);
  }

  100% {
    transform: scale(0.2) rotate(-15deg) translateY(-100px);
    filter: blur(20px) grayscale(1) brightness(10);
    opacity: 0;
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
  }

  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(220, 38, 38, 0);
  }

  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
  }
}

// List transitions
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}

.list-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem; // Separation between items
}

.step-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>
