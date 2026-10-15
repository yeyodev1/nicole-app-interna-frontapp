<script setup lang="ts">
import { computed } from 'vue'
import { formatECT, parseECTDate } from '@/utils/dateUtils'
import { DATE_PENDING_LABEL } from '@/utils/clientLink'

const emit = defineEmits(['edit-branch', 'edit-exit-point', 'edit-address', 'edit-maps-link'])

const props = defineProps({
  order: {
    type: Object,
    required: true,
  }
})

const displayDate = computed(() => {
  if (!props.order.deliveryDate) return props.order.clientLink?.token ? DATE_PENDING_LABEL : 'N/A'

  const date = parseECTDate(props.order.deliveryDate)
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0

  // Use formatECT for the date part (DD/MMM/YYYY)
  const datePart = formatECT(props.order.deliveryDate, false)

  // 1. Explicit deliveryTime takes priority (e.g. "12:30")
  if (props.order.deliveryTime && props.order.deliveryTime.includes(':')) {
    return `${datePart} ${props.order.deliveryTime}`
  }

  // 2. If no deliveryTime but the date has a specific time (not 00:00), show it
  if (!isMidnight) {
    const timeOpts: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }
    const timePart = new Intl.DateTimeFormat('es-EC', timeOpts).format(date)
    return `${datePart} ${timePart.toUpperCase()}`
  }

  // 3. Just the date for midnight orders
  return datePart
})

const isDelivery = computed(() => props.order.deliveryType === 'delivery')
const branchLabel = computed(() => props.order.branch || 'Centro de Producción')

const deliveryBadgeClass = computed(() => ({
  'badge-delivery': isDelivery.value,
  'badge-pickup': !isDelivery.value
}))
</script>

<template>
  <div class="order-summary-container">
    <div class="main-stats">
      <div class="stat-card primary">
        <span class="label">Pedido</span>
        <span class="value">#{{ order._id.substr(-6).toUpperCase() }}</span>
      </div>
      <div class="stat-card">
        <span class="label">Fecha Entrega</span>
        <span class="value">{{ displayDate }}</span>
      </div>
      <div class="stat-card">
        <span class="label">Facturación</span>
        <span class="badge" :class="order.invoiceStatus || 'NONE'">
          {{ order.invoiceStatus || 'No Requiere' }}
        </span>
      </div>
      <div class="stat-card">
        <span class="label">Responsable Original</span>
        <span class="value">{{ order.createdBy || order.responsible }}</span>
      </div>
      <div v-if="order.sellerName" class="stat-card">
        <span class="label">Vendedor (comisión)</span>
        <span class="value">{{ order.sellerName }}</span>
      </div>
      <div v-if="order.updatedBy && order.updatedBy !== (order.createdBy || order.responsible)" class="stat-card highlight">
        <span class="label">Última Edición</span>
        <span class="value">{{ order.updatedBy }}</span>
      </div>
    </div>

    <div class="delivery-highlight" :class="{ 'is-delivery': isDelivery }">
      <div class="highlight-header">
        <div class="type-indicator" :class="deliveryBadgeClass">
          <i :class="isDelivery ? 'fas fa-truck' : 'fas fa-store'"></i>
          {{ isDelivery ? 'Servicio de Delivery' : 'Retiro en Local' }}
        </div>
      </div>
      
      <div class="highlight-content">
        <div v-if="!isDelivery" class="pickup-info">
          <div class="info-item">
            <i class="fas fa-map-marker-alt"></i>
            <div>
              <span class="item-label">
                Local de Retiro
                <button class="btn-edit-inline" @click="emit('edit-branch')">
                  <i class="fas fa-pen"></i> Editar
                </button>
              </span>
              <span class="item-value">{{ branchLabel }}</span>
            </div>
          </div>
          <div v-if="order.skipProduction" class="store-pickup-indicator">
            <i class="fa-solid fa-store"></i>
            <div>
              <span class="item-label">Tipo de despacho</span>
              <span class="item-value store-value">Retiro directo de tienda</span>
            </div>
          </div>
          <div v-if="order.skipProduction && order.exitPoint" class="info-item">
            <i class="fa-solid fa-location-dot"></i>
            <div>
              <span class="item-label">
                Punto de Salida
                <button class="btn-edit-inline" @click="emit('edit-exit-point')">
                  <i class="fas fa-pen"></i> Editar
                </button>
              </span>
              <span class="item-value">{{ order.exitPoint }}</span>
            </div>
          </div>
        </div>

        <div v-else class="delivery-info">
          <div class="info-item">
            <i class="fas fa-map-pin"></i>
            <div>
              <span class="item-label">
                Dirección de Entrega
                <button class="btn-edit-inline" @click="emit('edit-address')">
                  <i class="fas fa-pen"></i> Editar
                </button>
              </span>
              <span class="item-value">{{ order.deliveryAddress }}</span>
            </div>
          </div>
          <div v-if="order.googleMapsLink" class="info-item link-item">
            <i class="fas fa-external-link-alt"></i>
            <div class="link-label-wrapper">
              <span class="item-label">
                Ubicación
                <button class="btn-edit-inline" @click="emit('edit-maps-link')">
                  <i class="fas fa-pen"></i> Editar
                </button>
              </span>
              <a :href="order.googleMapsLink" target="_blank" class="maps-link">
                Ver en Google Maps
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.order-summary-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
  width: 100%;
}

.main-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.stat-card {
  background: white;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid $border-light;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);

  &.primary {
    border-left: 4px solid $NICOLE-PURPLE;
  }

  &.highlight {
    background: #f0f9ff;
    border-color: #bae6fd;
    .label { color: #0369a1; }
    .value { color: #0c4a6e; }
  }

  .label {
    font-size: 0.65rem;
    color: $text-light;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .value {
    font-size: 0.95rem;
    font-weight: 700;
    color: $text-dark;
    font-family: $font-principal;
  }
}

.delivery-highlight {
  background: white;
  border-radius: 12px;
  border: 1px solid $border-light;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-left: 4px solid #0ea5e9; // Pickup blue

  &.is-delivery {
    border-left-color: #f43f5e; // Delivery red
  }

  .highlight-header {
    display: flex;
    align-items: center;
  }

  .type-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 800;
    text-transform: uppercase;
    font-size: 0.8rem;
    letter-spacing: 0.5px;

    &.badge-delivery {
      color: #f43f5e;
    }

    &.badge-pickup {
      color: #0ea5e9;
    }
  }

  .highlight-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .info-item {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;

    i {
      margin-top: 0.25rem;
      color: $text-light;
      font-size: 1rem;
    }

    div {
      display: flex;
      flex-direction: column;
    }

    .item-label {
      font-size: 0.7rem;
      color: $text-light;
      font-weight: 600;
    }

    .item-value {
      font-size: 1rem;
      font-weight: 700;
      color: $text-dark;
    }
  }

  .store-pickup-indicator {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    background: #fef3c7;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 0.6rem 0.75rem;

    i {
      margin-top: 0.25rem;
      color: #d97706;
      font-size: 1rem;
    }

    div {
      display: flex;
      flex-direction: column;
    }

    .item-label {
      font-size: 0.7rem;
      color: #b45309;
      font-weight: 600;
    }

    .store-value {
      font-size: 0.95rem;
      font-weight: 800;
      color: #92400e;
    }
  }

  .maps-link {
    color: $NICOLE-PURPLE;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.9rem;
    border-bottom: 2px solid rgba($NICOLE-PURPLE, 0.2);
    transition: all 0.2s;

    &:hover {
      color: $purple-dark;
      border-bottom-color: $NICOLE-PURPLE;
    }
  }
}

.item-label {
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 1rem;
}

.btn-edit-inline {
  background: #f1f5f9;
  border: none;
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  font-size: 0.65rem;
  font-weight: 800;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.2s;
  text-transform: uppercase;

  &:hover {
    background: $NICOLE-PURPLE;
    color: white;
  }

  i {
    font-size: 0.6rem !important;
    margin: 0 !important;
  }
}

.badge {
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  width: fit-content;

  &.PENDING {
    background: #fff7ed;
    color: #c2410c;
  }

  &.PROCESSED {
    background: #f0fdf4;
    color: #15803d;
  }

  &.ERROR {
    background: #fef2f2;
    color: #b91c1c;
  }

  &.NONE {
    background: $gray-100;
    color: #64748b;
  }
}
</style>
