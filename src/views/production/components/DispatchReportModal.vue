<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Product {
  _id: string
  name: string
  quantity: number
  alreadySent: number
  quantitySent: number // Form state
}

// El destino es el que registró el comercial en el pedido (sucursal o Delivery):
// se muestra con candado y no se puede cambiar. Ya no se exige "producido".
const props = defineProps<{
  isOpen: boolean
  orderId: string
  destination: string
  products: { _id: string, name: string, quantity: number, produced?: number }[]
  dispatches?: { items: { productId: string, quantitySent: number }[] }[]
}>()

const emit = defineEmits(['close', 'confirm'])

const items = ref<Product[]>([])
const notes = ref('')

// Al abrir: cantidades ya llenas con lo pendiente de cada producto
watch(() => props.isOpen, (val) => {
  if (val) {
    const sent = new Map<string, number>()
    for (const d of props.dispatches || []) for (const it of d.items || []) sent.set(String(it.productId), (sent.get(String(it.productId)) || 0) + (Number(it.quantitySent) || 0))
    items.value = props.products.map(p => {
      const alreadySent = sent.get(String(p._id)) || 0
      return {
        _id: p._id,
        name: p.name,
        quantity: p.quantity,
        alreadySent,
        quantitySent: Math.max(0, p.quantity - alreadySent),
      }
    })
    notes.value = ''
  }
}, { immediate: true })

const pendingOf = (i: Product) => Math.max(0, i.quantity - i.alreadySent)
const excessOf = (i: Product) => i.alreadySent + (Number(i.quantitySent) || 0) - i.quantity

const totalStatus = computed(() => {
  if (items.value.some(i => (Number(i.quantitySent) || 0) > 0 && excessOf(i) > 0)) return { label: 'ENVÍO CON PRODUCTO DE MÁS', class: 'status-excess' }
  if (items.value.some(i => excessOf(i) < 0)) return { label: 'ENVÍO PARCIAL', class: 'status-partial' }
  return { label: 'ENVÍO COMPLETO', class: 'status-ok' }
})

const canConfirm = computed(() =>
  items.value.some(i => (Number(i.quantitySent) || 0) > 0) && items.value.every(i => (Number(i.quantitySent) || 0) >= 0)
)

const handleConfirm = () => {
  if (!canConfirm.value) return

  const payload = {
    items: items.value
      .filter(i => (Number(i.quantitySent) || 0) > 0)
      .map(i => ({
        productId: i._id,
        name: i.name,
        quantitySent: Math.round(Number(i.quantitySent))
      })),
    notes: notes.value,
    destination: props.destination
  }
  emit('confirm', payload)
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <header>
        <h2>Reportar Envío</h2>
      </header>

      <div class="dest-fixed">
        <div>
          <span class="df-label">Destino (lo registró el comercial)</span>
          <b>{{ destination }}</b>
          <small>Si el cliente cambió de local, el comercial corrige la sucursal del pedido antes del despacho.</small>
        </div>
        <i class="fas fa-lock" aria-label="No se puede cambiar"></i>
      </div>

      <div class="status-bar" :class="totalStatus.class">
        {{ totalStatus.label }}
      </div>

      <div class="items-list">
        <div v-for="item in items" :key="item._id" class="item-row">
          <div class="item-info">
            <span class="name">{{ item.name }}</span>
            <div class="metrics">
                <span class="req">Pedido: {{ item.quantity }}</span>
                <span class="produced">Enviado: {{ item.alreadySent }}</span>
            </div>
            <span v-if="(Number(item.quantitySent) || 0) > 0 && excessOf(item) > 0" class="row-note over">+{{ excessOf(item) }} de más de lo pedido</span>
            <span v-else-if="(Number(item.quantitySent) || 0) > 0 && excessOf(item) < 0" class="row-note partial">quedan {{ -excessOf(item) }} por enviar</span>
          </div>
          <div class="item-input">
            <label>A Enviar:</label>
            <input
              type="number"
              v-model.number="item.quantitySent"
              min="0"
              :class="{
                'input-excess': excessOf(item) > 0 && (Number(item.quantitySent) || 0) > 0,
                'input-partial': (Number(item.quantitySent) || 0) < pendingOf(item) && (Number(item.quantitySent) || 0) > 0
              }"
            />
          </div>
        </div>
      </div>

      <div class="notes-section">
        <label>Notas Adicionales:</label>
        <textarea v-model="notes" placeholder="Ej: Se enviaron 2 de más por compensación..."></textarea>
         <p class="hint">Podrás editar este reporte durante 1 hora.</p>
      </div>

      <div class="actions">
        <button class="btn-cancel" @click="$emit('close')">Cancelar</button>
        <button class="btn-confirm" @click="handleConfirm" :disabled="!canConfirm">Registrar Envío</button>
      </div>
    </div>
  </div>
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
  background: white;
  width: 90%;
  max-width: 500px;
  border-radius: 12px;
  padding: 1.5rem;
  font-family: $font-stack;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  max-height: 90vh;
  overflow-y: auto;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #2c3e50;
  }

  .destination-badge {
    background: #eaf2f8;
    color: #3498db;
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
  }
}

.dest-fixed {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 1rem;
  padding: 12px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;

  b { display: block; font-size: 15px; color: #1e293b; }
  small { display: block; color: #94a3b8; font-size: 12px; font-weight: 600; margin-top: 2px; }
  .df-label { display: block; font-size: 10px; font-weight: 800; letter-spacing: .06em; color: #94a3b8; text-transform: uppercase; }
  > i { margin-left: auto; font-size: 18px; color: #64748b; }
}

.row-note {
  display: block;
  font-size: 11px;
  font-weight: 700;
  margin-top: 3px;
  &.over { color: #7e22ce; }
  &.partial { color: #92400e; }
}

.status-bar {
  text-align: center;
  padding: 0.5rem;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.8rem;
  margin-bottom: 1.5rem;

  &.status-ok {
    background: #eafaf1;
    color: #2ecc71;
  }

  &.status-partial {
    background: #fef9e7;
    color: #f1c40f;
  }

  &.status-excess {
    background: #fdedec;
    color: #e74c3c;
  }
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #f1f2f6;

  .item-info {
    display: flex;
    flex-direction: column;

    .name {
      font-weight: 600;
      font-size: 0.9rem;
      color: #2c3e50;
    }

    .metrics {
      display: flex;
      gap: 0.8rem;
      align-items: center;

      .req {
        font-size: 0.75rem;
        color: #7f8c8d;
      }

      .produced {
        font-size: 0.75rem;
        font-weight: 700;
        color: #2ecc71;
        background: rgba(46, 204, 113, 0.1);
        padding: 1px 6px;
        border-radius: 4px;

        &.warning {
          color: #e67e22;
          background: rgba(230, 126, 34, 0.1);
        }
      }
    }
  }

  .item-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #95a5a6;
    }

    input {
      width: 60px;
      padding: 0.4rem;
      border: 1px solid #bdc3c7;
      border-radius: 6px;
      text-align: center;
      font-weight: 700;

      &.input-excess {
        border-color: #e74c3c;
        color: #e74c3c;
        background: #fdedec;
      }

      &.input-partial {
        border-color: #f1c40f;
      }
    }
  }
}

.notes-section {
  margin-bottom: 1.5rem;

  label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: #2c3e50;
  }

  textarea {
    width: 100%;
    padding: 0.8rem;
    border: 1px solid #dfe6e9;
    border-radius: 8px;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;

    &:focus {
      outline: none;
      border-color: #3498db;
    }
  }

  .hint {
    font-size: 0.7rem;
    color: #95a5a6;
    margin-top: 0.3rem;
    text-align: right;
  }
}

.actions {
  display: flex;
  gap: 1rem;

  button {
    flex: 1;
    padding: 0.8rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    border: none;
    transition: all 0.2s;

    &.btn-cancel {
      background: #f1f2f6;
      color: #7f8c8d;

      &:hover {
        background: #e1e8ed;
      }
    }

    &.btn-confirm {
      background: #2ecc71;
      color: white;

      &:hover {
        background: #27ae60;
      }
    }
  }
}
</style>
