<script setup lang="ts">


import { parseECTDate, formatECT } from '@/utils/dateUtils'

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

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

const formatDelivery = (order: any) => {
  if (!order.deliveryDate) return { date: '—', time: '--:--' }

  const d = parseECTDate(order.deliveryDate)
  const day = d.getDate().toString().padStart(2, '0')
  const month = MONTHS[d.getMonth()]
  const dateStr = `${day} ${month}`

  if (order.deliveryTime && order.deliveryTime.includes(':')) {
    return { date: dateStr, time: order.deliveryTime }
  }

  const isMidnight = d.getHours() === 0 && d.getMinutes() === 0
  if (isMidnight) return { date: dateStr, time: '--:--' }

  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
  return { date: dateStr, time: new Intl.DateTimeFormat('es-EC', timeOpts).format(d) }
}

const formatCreatedAt = (order: any) => {
  if (!order.createdAt) return null
  const d = new Date(order.createdAt)
  const day = d.getDate().toString().padStart(2, '0')
  const month = MONTHS[d.getMonth()]
  const hours = d.getHours().toString().padStart(2, '0')
  const mins = d.getMinutes().toString().padStart(2, '0')
  return { date: `${day} ${month}`, time: `${hours}:${mins}` }
}

const getPaymentStatus = (order: any) => {
  if (order.settledInIsland) return 'settled'
  const totalPaid = (order.payments || []).reduce((sum: number, p: any) => sum + (p.monto || 0), 0)
  const totalValue = order.totalValue || 0
  if (totalPaid >= totalValue - 0.05) return 'paid'
  if (totalPaid > 0) return 'partial'
  return 'pending'
}

// Pedidos de la tienda online
const isWebOrder = (order: any) => !!order.webOrder?.externalId || order.salesChannel === 'Tienda Online'

const getWebPayment = (order: any) => {
  const status = order.webOrder?.paymentStatus
  if (status === 'PAID') return { label: 'Pagado', class: 'paid', icon: 'fas fa-check-circle' }
  if (status === 'PENDING_VERIFICATION') return { label: 'Transferencia por verificar', class: 'verify', icon: 'fas fa-hourglass-half' }
  return null
}

// Handler wrappers to stop propagation where needed
const handleRetry = () => emit('retry-invoice')
</script>

<template>
  <article
    class="order-card"
    :class="{
      'selecting': isSelected,
      'invoice-processed': order.invoiceStatus === 'PROCESSED',
      'invoice-error': order.invoiceStatus === 'ERROR',
      'web-pending': order.status === 'PENDIENTE_GESTION'
    }"
    @click="emit('click')"
  >

    <!-- Invoice Error Banner -->
    <div v-if="order.invoiceStatus === 'ERROR'" class="error-banner">
      <i class="fas fa-exclamation-triangle"></i>
      <span>Error de Facturación — Requiere atención</span>
    </div>

    <!-- Retiro de Tienda Banner -->
    <div v-if="order.skipProduction" class="store-pickup-banner">
      <i class="fa-solid fa-store"></i>
      <span>Retiro directo de tienda{{ order.exitPoint ? ` — ${order.exitPoint}` : '' }}</span>
    </div>

    <!-- Batch Checkbox -->
    <div v-if="batchMode" class="batch-checkbox">
       <input 
         type="checkbox" 
         :checked="isSelected"
         @click.stop="emit('toggle-select')"
       >
    </div>

    <!-- Header -->
    <div class="card-header">
      <div class="header-left">
        <!-- Fecha de entrega -->
        <div class="date-pill delivery-pill">
          <i class="fa-solid fa-calendar-check"></i>
          <span class="pill-label">Entrega</span>
          <span class="pill-date">{{ formatDelivery(order).date }}</span>
          <span class="pill-sep">·</span>
          <span class="pill-time">{{ formatDelivery(order).time }}</span>
        </div>
        <!-- Fecha de registro -->
        <div v-if="formatCreatedAt(order)" class="date-pill registered-pill">
          <i class="fa-regular fa-calendar-plus"></i>
          <span class="pill-label">Registro</span>
          <span class="pill-date">{{ formatCreatedAt(order)!.date }}</span>
          <span class="pill-sep">·</span>
          <span class="pill-time">{{ formatCreatedAt(order)!.time }}</span>
        </div>
      </div>
      <span class="type-badge" :class="order.deliveryType">
        {{ order.deliveryType === 'delivery' ? 'Delivery' : 'Retiro' }}
      </span>
    </div>

    <!-- Tienda online -->
    <div v-if="isWebOrder(order)" class="web-row">
      <span class="web-badge channel" :title="order.webOrder?.code ? `Pedido web ${order.webOrder.code}` : 'Pedido de la tienda online'">
        <i class="fas fa-shopping-bag"></i>
        Tienda Online
        <span v-if="order.webOrder?.code" class="web-code">{{ order.webOrder.code }}</span>
      </span>
      <span v-if="order.status === 'PENDIENTE_GESTION'" class="web-badge pending">
        <i class="fas fa-bell"></i> Pendiente de gestionar
      </span>
      <span v-else-if="order.status === 'GESTIONADO'" class="web-badge managed" :title="order.webOrder?.managedBy ? `Gestionado por ${order.webOrder.managedBy}` : ''">
        <i class="fas fa-check"></i> Gestionado
      </span>
      <span v-if="getWebPayment(order)" class="web-badge payment" :class="getWebPayment(order)!.class">
        <i :class="getWebPayment(order)!.icon"></i> {{ getWebPayment(order)!.label }}
      </span>
    </div>

    <!-- Client Info -->
    <div class="client-section">
      <h3 class="client-name" :title="order.customerName">{{ order.customerName }}</h3>
      <p class="client-detail">
        <i class="fas fa-user-circle"></i> {{ order.responsible }}
      </p>

      <!-- Sucursal / Punto de retiro -->
      <div class="location-row">
        <template v-if="order.skipProduction">
          <span class="location-chip store">
            <i class="fa-solid fa-store"></i>
            {{ order.exitPoint || 'Tienda' }}
          </span>
        </template>
        <template v-else>
          <span class="location-chip branch">
            <i class="fa-solid fa-location-dot"></i>
            {{ order.branch || 'Sin sucursal' }}
          </span>
        </template>
      </div>

      <div v-if="order.comments" class="order-comments" :title="order.comments">
        <i class="far fa-comment-dots"></i>
        <span>{{ order.comments }}</span>
      </div>
    </div>

    <!-- Financials -->
    <div class="financial-row">
       <div class="amount-group">
          <span class="label">Total</span>
          <span class="amount">${{ order.totalValue.toFixed(2) }}</span>
       </div>
       <div class="status-group">
          <!-- Settlement / Payment Badge -->
          <div v-if="order.settledInIsland" class="settled-badge" :title="'Facturado en ' + order.settledIslandName">
             <i class="fas fa-store"></i>
             <span>{{ order.settledIslandName }}</span>
          </div>

          <!-- Invoice Processed Badge (Explicit) -->
          <div v-else-if="order.invoiceStatus === 'PROCESSED'" class="invoice-badge" title="Factura Generada y Enviada">
             <i class="fas fa-file-invoice-dollar"></i>
             <span>Facturado</span>
          </div>

          <!-- Payment Icon if not settled (or keep logic separate?) -->
          <!-- The previous logic showed Payment Status IF NOT Settled. 
               Now we might have Invoice Processed AND Payment Status (e.g. Paid).
               User wants clear indication of invoice. Let's show BOTH if possible, 
               or Stack them. Flex-col or simple stacking in status-group. -->
          
          <div class="payment-status" :class="getPaymentStatus(order)" title="Estado Pago">
             <i :class="{
              'fas fa-check-circle': getPaymentStatus(order) === 'paid',
              'fas fa-adjust': getPaymentStatus(order) === 'partial',
              'far fa-circle': getPaymentStatus(order) === 'pending'
            }"></i>
             <span v-if="!order.invoiceStatus || order.invoiceStatus !== 'PROCESSED'"> 
                <!-- Hide text if Facturado to save space? Or keep? User wants CLARITY. Keep. -->
                {{
                  getPaymentStatus(order) === 'paid' ? 'Pagado' :
                    getPaymentStatus(order) === 'partial' ? 'Parcial' : 'Pendiente'
                }}
             </span>
             <span v-else>{{ getPaymentStatus(order) === 'paid' ? 'Pagado' : 'Pendiente' }}</span>
          </div>
       </div>
    </div>


    <!-- Actions Footer -->
    <div class="card-actions" @click.stop>

      <!-- Retry Invoice: primary CTA when in ERROR state -->
      <button
        v-if="order.invoiceStatus === 'ERROR'"
        class="btn-retry-primary"
        @click="handleRetry"
      >
        <i class="fa-solid fa-rotate-right"></i>
        Reintentar Factura
      </button>

      <!-- WhatsApp copy: shown when NOT in error -->
      <button v-else class="btn-whatsapp-copy" @click="emit('copy-summary')">
        <i class="fa-brands fa-whatsapp"></i> Copiar Pedido
      </button>

      <div class="icon-actions">
        <!-- Cobro -->
        <div class="icon-btn-wrap">
          <button
            class="btn-icon"
            @click="emit('payment')"
            :class="{
              'is-paid': getPaymentStatus(order) === 'paid',
              'is-partial': getPaymentStatus(order) === 'partial'
            }"
          >
            <i class="fa-solid fa-dollar-sign"></i>
          </button>
          <span class="icon-label">Cobro</span>
        </div>

        <!-- Datos de factura (solo si no está pagado/procesado) -->
        <div
          v-if="order.invoiceStatus !== 'PROCESSED' && getPaymentStatus(order) !== 'paid' && getPaymentStatus(order) !== 'settled'"
          class="icon-btn-wrap"
        >
          <button class="btn-icon" @click="emit('invoice-edit')">
            <i class="fa-solid fa-file-invoice"></i>
          </button>
          <span class="icon-label">Factura</span>
        </div>

        <!-- Isla (solo si no está facturado en isla) -->
        <div v-if="!order.settledInIsland" class="icon-btn-wrap">
          <button class="btn-icon btn-settle" @click="emit('settle')">
            <i class="fa-solid fa-store"></i>
          </button>
          <span class="icon-label">Isla</span>
        </div>

        <!-- Ver -->
        <div v-if="batchMode" class="icon-btn-wrap">
          <button class="btn-icon btn-view" @click="emit('view-detail')">
            <i class="fa-solid fa-eye"></i>
          </button>
          <span class="icon-label">Ver</span>
        </div>

        <!-- Editar -->
        <div class="icon-btn-wrap">
          <button class="btn-icon btn-edit" @click="emit('edit')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <span class="icon-label">Editar</span>
        </div>

        <!-- Devolver (solo si fue despachado) -->
        <div
          v-if="['SENT', 'PARTIAL', 'PROBLEM'].includes(order.dispatchStatus || '')"
          class="icon-btn-wrap"
        >
          <button class="btn-icon btn-return" @click="emit('return')">
            <i class="fa-solid fa-reply"></i>
          </button>
          <span class="icon-label">Devolver</span>
        </div>

        <!-- Eliminar -->
        <div class="icon-btn-wrap">
          <button class="btn-icon btn-delete" @click="emit('delete')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
          <span class="icon-label">Eliminar</span>
        </div>
      </div>
    </div>
  </article>
</template>

<style lang="scss" scoped>
/* Copied and adapted from OrderListView */
.order-card {
  background: white;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 1.35rem 1.4rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  position: relative;
  gap: 1.1rem;
  overflow: hidden;


  /* Styles for processed invoice */
  &.invoice-processed {
    background: #f0fdf4;
    border-left: 4px solid #22c55e;
  }

  /* Styles for invoice error */
  &.invoice-error {
    border-left: 4px solid #ef4444;
  }

  /* Pedido de la tienda online sin gestionar */
  &.web-pending:not(.invoice-error):not(.invoice-processed) {
    border-left: 4px solid #f59e0b;
  }

  &.selecting {
    border-color: #8b5cf6;
    background: #fdf4ff;
  }


  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-width: 0;
    }

    .date-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 600;
      width: fit-content;

      i { font-size: 0.75rem; }

      .pill-label {
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.75;
      }

      .pill-date { font-weight: 700; }

      .pill-sep { opacity: 0.4; }

      .pill-time { font-weight: 800; letter-spacing: 0.3px; }
    }

    .delivery-pill {
      background: #ede9fe;
      color: #5b21b6;
      border: 1px solid #ddd6fe;
    }

    .registered-pill {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    .type-badge {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 6px;
      white-space: nowrap;
      flex-shrink: 0;

      &.delivery {
        background: #fee2e2;
        color: #b91c1c;
      }

      &.retiro {
        background: #e0f2fe;
        color: #0369a1;
      }
    }
  }

  /* Invoice Processed Badge Logic can be added here if needed, 
     but the border-left and bg is usually enough visual cue. */


  .client-section {
    min-width: 0;

    .client-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.25rem 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      max-width: 100%;
    }

    .client-detail {
      font-size: 0.85rem;
      color: #64748b;
      margin: 0 0 0.5rem 0;
    }

    .location-row {
      margin: 0.35rem 0 0;
    }

    .location-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 20px;

      &.branch {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;

        i { color: #3b82f6; }
      }

      &.store {
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fde68a;

        i { color: #d97706; }
      }
    }

    .order-comments {
      font-size: 0.8rem;
      color: #64748b;
      background: #f8fafc;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      display: -webkit-box;
      line-clamp: 2;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 0.5rem;
      border: 1px solid #e2e8f0;

      i {
        color: #8b5cf6;
        margin-right: 0.3rem;
      }
    }
  }

  .financial-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-top: 0.5rem;
    border-top: 1px dashed #f1f5f9;

    .amount-group {
      display: flex;
      flex-direction: column;

      .label {
        font-size: 0.7rem;
        text-transform: uppercase;
        color: #94a3b8;
        font-weight: 700;
      }

      .amount {
        font-size: 1.2rem;
        font-weight: 800;
        color: #8b5cf6;
        font-family: inherit; // Or specific font
      }
    }

    .status-group {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }

    .invoice-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: #15803d; // Green-700
      background: #dcfce7; // Green-100
      border: 1px solid #86efac; // Green-300
      padding: 2px 8px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      cursor: help;
    }

    .payment-status {

      font-size: 0.8rem;
      font-weight: 600;
      color: #ef4444; // error
      display: flex;
      align-items: center;
      gap: 0.3rem;

      &.paid {
        color: #22c55e;
      }

      &.partial {
        color: #f59e0b;
      }
    }

    .settled-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: #8b5cf6;
      background: rgba(139, 92, 246, 0.08);
      padding: 4px 10px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      border: 1px solid rgba(139, 92, 246, 0.15);

      i {
        font-size: 0.8rem;
      }
    }
  }

  .card-actions {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid #f8fafc;

    @media (max-width: 480px) {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-whatsapp-copy {
      flex: 1;
      background: #25D366;
      color: white;
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(37, 211, 102, 0.2);

      &:hover {
        background: #128c7e;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(37, 211, 102, 0.3);
      }
    }

    .btn-retry-primary {
      flex: 1;
      background: #ef4444;
      color: white;
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(239, 68, 68, 0.25);
      animation: pulse-red 2s infinite;

      &:hover {
        background: #dc2626;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(239, 68, 68, 0.35);
      }
    }

    .icon-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: flex-end;

      @media (max-width: 480px) {
        justify-content: center;
        margin-top: 0.5rem;
      }
    }

    .icon-btn-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;

      .icon-label {
        font-size: 0.6rem;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        white-space: nowrap;
      }
    }

    .btn-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e2e8f0;
      background: white;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 1rem;

      &:hover {
        border-color: #8b5cf6;
        color: #8b5cf6;
        background: #f8fafc;
      }

      &.is-paid {
        color: #22c55e;
        border-color: #22c55e;
        background: #f0fdf4;
      }

      &.is-partial {
        color: #f59e0b;
        border-color: #f59e0b;
        background: #fffbeb;
      }

      &.btn-delete:hover {
        color: #ef4444;
        border-color: #ef4444;
        background: #fef2f2;
      }

      &.btn-view:hover {
        color: #0284c7;
        border-color: #0284c7;
        background: #f0f9ff;
      }

      &.btn-return {
        color: #f97316;
        border-color: #fed7aa;
        background: #fff7ed;

        &:hover {
          background: #f97316;
          color: white;
          border-color: #f97316;
        }
      }

      &.btn-settle:hover {
        color: #8b5cf6;
        border-color: #8b5cf6;
        background: #fdf4ff;
      }
    }
  }
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fef2f2;
  color: #dc2626;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #fecaca;
  margin: -0.25rem 0;

  i {
    font-size: 0.85rem;
    flex-shrink: 0;
  }
}

.web-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: -0.35rem 0;
}

.web-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
  border: 1px solid transparent;
  white-space: nowrap;

  i { font-size: 0.7rem; }

  &.channel {
    background: #490F57;
    color: white;

    .web-code {
      font-weight: 600;
      opacity: 0.8;
      letter-spacing: 0.3px;
    }
  }

  &.pending {
    background: #fef3c7;
    color: #92400e;
    border-color: #fde68a;
  }

  &.managed {
    background: #f1f5f9;
    color: #64748b;
    border-color: #e2e8f0;
    font-weight: 600;
  }

  &.payment.paid {
    background: #f0fdf4;
    color: #15803d;
    border-color: #bbf7d0;
  }

  &.payment.verify {
    background: #fff7ed;
    color: #c2410c;
    border-color: #fed7aa;
  }
}

.store-pickup-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #fde68a;
  margin: -0.25rem 0;

  i {
    font-size: 0.85rem;
    flex-shrink: 0;
    color: #d97706;
  }
}

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
}

.batch-checkbox {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10;

  input {
    width: 22px;
    height: 22px;
    cursor: pointer;
    accent-color: #8b5cf6;
  }
}
</style>
