<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import RequisitionService, { type Requisition } from '@/services/requisition.service'
import { useToast } from '@/composables/useToast'

const { success, error: showError } = useToast()

const requisitions = ref<Requisition[]>([])
const isLoading = ref(false)
const statusFilter = ref<'active' | 'history'>('active')

// Modal despacho
const dispatching = ref<Requisition | null>(null)
const dispatchItems = ref<{ itemId: string; name: string; quantity: number; unit: string; quantityDispatched: number; itemNote: string }[]>([])
const dispatchedBy = ref('')
const isSaving = ref(false)

// Modal confirmación (firma)
const confirming = ref<Requisition | null>(null)
const confirmedBy = ref('')
const confirmationNote = ref('')

const userName = computed(() => {
  try { return JSON.parse(localStorage.getItem('user_info') || '{}')?.name || '' } catch { return '' }
})

const statusLabel: Record<string, string> = {
  REQUESTED: 'Solicitado',
  PREPARING: 'Preparando',
  DISPATCHED: 'Despachado',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
}

const fetchRequisitions = async () => {
  isLoading.value = true
  try {
    const params: any = statusFilter.value === 'active'
      ? { status: ['REQUESTED', 'PREPARING', 'DISPATCHED'] }
      : { status: ['CONFIRMED', 'CANCELLED'] }
    const res = await RequisitionService.getRequisitions(params)
    requisitions.value = res.requisitions || []
  } catch {
    showError('Error cargando requerimientos')
  } finally {
    isLoading.value = false
  }
}

const setStatus = async (req: Requisition, status: 'PREPARING' | 'CANCELLED') => {
  try {
    await RequisitionService.updateStatus(req._id, status)
    success(status === 'PREPARING' ? 'Marcado como preparando' : 'Requerimiento cancelado')
    await fetchRequisitions()
  } catch (e: any) {
    showError(e?.message || 'Error actualizando estado')
  }
}

const openDispatch = (req: Requisition) => {
  dispatching.value = req
  dispatchedBy.value = userName.value
  dispatchItems.value = req.items.map((i: any) => ({
    itemId: i._id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    quantityDispatched: i.quantity,
    itemNote: '',
  }))
}

const submitDispatch = async () => {
  if (!dispatching.value) return
  isSaving.value = true
  try {
    await RequisitionService.dispatch(dispatching.value._id, {
      dispatchedBy: dispatchedBy.value || undefined,
      items: dispatchItems.value.map(d => ({
        itemId: d.itemId,
        quantityDispatched: d.quantityDispatched,
        itemNote: d.itemNote || undefined,
      })),
    })
    success('Despachado. Stock descontado automáticamente.')
    dispatching.value = null
    await fetchRequisitions()
  } catch (e: any) {
    showError(e?.message || 'Error al despachar')
  } finally {
    isSaving.value = false
  }
}

const openConfirm = (req: Requisition) => {
  confirming.value = req
  confirmedBy.value = ''
  confirmationNote.value = ''
}

const submitConfirm = async () => {
  if (!confirming.value) return
  if (!confirmedBy.value.trim()) {
    showError('La firma (nombre de quien recibe) es obligatoria.')
    return
  }
  isSaving.value = true
  try {
    await RequisitionService.confirm(confirming.value._id, {
      confirmedBy: confirmedBy.value.trim(),
      confirmationNote: confirmationNote.value || undefined,
    })
    success('Recepción confirmada con firma electrónica')
    confirming.value = null
    await fetchRequisitions()
  } catch (e: any) {
    showError(e?.message || 'Error al confirmar')
  } finally {
    isSaving.value = false
  }
}

const fmtDate = (d?: string) => d
  ? new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
  : '—'

onMounted(fetchRequisitions)
</script>

<template>
  <div class="requisitions-view">
    <div class="req-header">
      <div>
        <h1><i class="fas fa-clipboard-list"></i> Requerimientos Internos</h1>
        <p>Pedidos de cocina/producción a bodega, con despacho y firma electrónica</p>
      </div>
      <div class="filter-tabs">
        <button :class="{ active: statusFilter === 'active' }" @click="statusFilter = 'active'; fetchRequisitions()">Activos</button>
        <button :class="{ active: statusFilter === 'history' }" @click="statusFilter = 'history'; fetchRequisitions()">Historial</button>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando...</p>
    </div>

    <div v-else-if="requisitions.length === 0" class="empty-state">
      <i class="fas fa-clipboard"></i>
      <p>No hay requerimientos {{ statusFilter === 'active' ? 'activos' : 'en historial' }}</p>
    </div>

    <div v-else class="req-cards">
      <div v-for="req in requisitions" :key="req._id" class="req-card" :class="`card--${req.status.toLowerCase()}`">
        <div class="card-head">
          <div>
            <strong>{{ req.area }}</strong>
            <span v-if="req.brand" class="brand-chip">{{ req.brand }}</span>
            <span v-if="req.source === 'POS_CLOSING'" class="brand-chip source-chip" title="Generado automáticamente desde el cierre de producción del punto de venta">Cierre POS</span>
          </div>
          <span class="badge" :class="`badge--${req.status.toLowerCase()}`">{{ statusLabel[req.status] }}</span>
        </div>

        <div class="meta">
          <span><i class="fas fa-user"></i> {{ req.requestedByName }}</span>
          <span><i class="fas fa-calendar"></i> {{ fmtDate(req.createdAt) }}</span>
          <span v-if="req.neededForDate"><i class="fas fa-flag"></i> Para: {{ fmtDate(req.neededForDate) }}</span>
        </div>

        <ul class="items-list">
          <li v-for="item in req.items" :key="item._id">
            {{ item.quantity }} {{ item.unit }} — {{ item.name }}
            <em v-if="item.quantityDispatched !== undefined && item.quantityDispatched !== item.quantity" class="partial">
              (despachado: {{ item.quantityDispatched }})
            </em>
            <em v-if="item.itemNote" class="note">· {{ item.itemNote }}</em>
          </li>
        </ul>

        <p v-if="req.notes" class="req-notes"><i class="fas fa-comment"></i> {{ req.notes }}</p>

        <div v-if="req.status === 'DISPATCHED'" class="dispatch-info">
          Despachado por {{ req.dispatchedBy }} · {{ fmtDate(req.dispatchedAt) }}
        </div>
        <div v-if="req.status === 'CONFIRMED'" class="confirm-info">
          <i class="fas fa-signature"></i> Recibido por {{ req.confirmedBy }} · {{ fmtDate(req.confirmedAt) }}
          <span v-if="req.confirmationNote">· {{ req.confirmationNote }}</span>
        </div>

        <div class="card-actions">
          <template v-if="req.status === 'REQUESTED'">
            <button class="btn-secondary" @click="setStatus(req, 'PREPARING')">Preparando</button>
            <button class="btn-primary" @click="openDispatch(req)">Despachar</button>
            <button class="btn-danger" @click="setStatus(req, 'CANCELLED')">Cancelar</button>
          </template>
          <template v-else-if="req.status === 'PREPARING'">
            <button class="btn-primary" @click="openDispatch(req)">Despachar</button>
            <button class="btn-danger" @click="setStatus(req, 'CANCELLED')">Cancelar</button>
          </template>
          <template v-else-if="req.status === 'DISPATCHED'">
            <button class="btn-confirm" @click="openConfirm(req)">
              <i class="fas fa-signature"></i> Confirmar recepción
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Modal despacho -->
    <div v-if="dispatching" class="modal-overlay" @click.self="dispatching = null">
      <div class="modal">
        <h3>Despachar — {{ dispatching.area }}</h3>
        <div class="check-table-wrap">
          <table class="check-table">
            <thead>
              <tr><th>Ítem</th><th>Solicitado</th><th>A despachar</th><th>Nota</th></tr>
            </thead>
            <tbody>
              <tr v-for="d in dispatchItems" :key="d.itemId">
                <td>{{ d.name }}</td>
                <td>{{ d.quantity }} {{ d.unit }}</td>
                <td><input type="number" min="0" v-model.number="d.quantityDispatched" class="qty-input" /></td>
                <td><input type="text" v-model="d.itemNote" placeholder="Ej. faltó stock" class="note-input" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="form-row">
          <label>Despachado por</label>
          <input type="text" v-model="dispatchedBy" />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="dispatching = null">Cancelar</button>
          <button class="btn-primary" :disabled="isSaving" @click="submitDispatch">
            {{ isSaving ? 'Despachando...' : 'Despachar y descontar stock' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal confirmación -->
    <div v-if="confirming" class="modal-overlay" @click.self="confirming = null">
      <div class="modal modal--small">
        <h3><i class="fas fa-signature"></i> Confirmar recepción</h3>
        <p class="hint">Quien recibe firma electrónicamente escribiendo su nombre.</p>
        <div class="form-row">
          <label>Nombre de quien recibe *</label>
          <input type="text" v-model="confirmedBy" placeholder="Ej. Brian" />
        </div>
        <div class="form-row">
          <label>Observación</label>
          <textarea v-model="confirmationNote" rows="2" placeholder="Ej. llegó todo / faltó X"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="confirming = null">Cancelar</button>
          <button class="btn-confirm" :disabled="isSaving" @click="submitConfirm">
            {{ isSaving ? 'Guardando...' : 'Firmar y confirmar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.requisitions-view {
  padding: 1.5rem;
  max-width: 1100px;
  margin: 0 auto;
}

.req-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;

  h1 {
    font-size: 1.4rem;
    margin: 0 0 0.25rem;
    i { color: #7c3aed; margin-right: 0.5rem; }
  }
  p { color: #6b7280; margin: 0; font-size: 0.9rem; }
}

.filter-tabs {
  display: flex;
  gap: 0.4rem;

  button {
    padding: 0.45rem 1rem;
    border: 1px solid #d1d5db;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;

    &.active { background: #7c3aed; color: white; border-color: #7c3aed; }
  }
}

.req-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.req-card {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  &.card--requested { border-left: 4px solid #d97706; }
  &.card--preparing { border-left: 4px solid #2563eb; }
  &.card--dispatched { border-left: 4px solid #7c3aed; }
  &.card--confirmed { border-left: 4px solid #059669; }
  &.card--cancelled { border-left: 4px solid #9ca3af; opacity: 0.75; }
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.brand-chip {
  margin-left: 0.5rem;
  background: #ede9fe;
  color: #6d28d9;
  border-radius: 999px;
  padding: 0.1rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.badge {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;

  &.badge--requested { background: #fef3c7; color: #b45309; }
  &.badge--preparing { background: #dbeafe; color: #1d4ed8; }
  &.badge--dispatched { background: #ede9fe; color: #6d28d9; }
  &.badge--confirmed { background: #d1fae5; color: #047857; }
  &.badge--cancelled { background: #e5e7eb; color: #4b5563; }
}

.meta {
  display: flex;
  gap: 0.9rem;
  flex-wrap: wrap;
  font-size: 0.78rem;
  color: #6b7280;

  i { margin-right: 0.25rem; }
}

.items-list {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.85rem;
  color: #374151;

  .partial { color: #b45309; font-style: normal; font-size: 0.78rem; }
  .note { color: #9ca3af; font-size: 0.78rem; }
}

.req-notes {
  margin: 0;
  font-size: 0.82rem;
  color: #6b7280;
  i { margin-right: 0.3rem; }
}

.dispatch-info, .confirm-info {
  font-size: 0.8rem;
  color: #6b7280;
}
.confirm-info { color: #047857; }

.card-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.btn-primary, .btn-secondary, .btn-danger, .btn-confirm {
  border: none;
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.82rem;
}
.btn-primary { background: #7c3aed; color: white; &:hover { background: #6d28d9; } &:disabled { opacity: 0.6; } }
.btn-secondary { background: #dbeafe; color: #1d4ed8; }
.btn-danger { background: #fee2e2; color: #b91c1c; }
.btn-confirm { background: #059669; color: white; &:hover { background: #047857; } &:disabled { opacity: 0.6; } }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal {
  background: white;
  border-radius: 14px;
  padding: 1.25rem;
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;

  h3 { margin: 0 0 1rem; }
  &.modal--small { max-width: 440px; }
  .hint { font-size: 0.85rem; color: #6b7280; margin: -0.5rem 0 0.75rem; }
}

.check-table-wrap { overflow-x: auto; margin-bottom: 1rem; }

.check-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;

  th, td {
    padding: 0.45rem 0.6rem;
    border-bottom: 1px solid #f3f4f6;
    text-align: left;
  }
  th { background: #f9fafb; }
}

.qty-input { width: 90px; padding: 0.3rem; border: 1px solid #d1d5db; border-radius: 6px; }
.note-input { width: 100%; padding: 0.3rem; border: 1px solid #d1d5db; border-radius: 6px; }

.form-row {
  margin-bottom: 0.75rem;
  label {
    display: block;
    font-size: 0.82rem;
    font-weight: 600;
    color: #4b5563;
    margin-bottom: 0.25rem;
  }
  input, textarea {
    width: 100%;
    padding: 0.5rem 0.7rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.9rem;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1rem;
}

.btn-cancel {
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
  i { font-size: 2rem; margin-bottom: 0.5rem; color: #d1d5db; }
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #7c3aed;
  border-radius: 50%;
  margin: 0 auto 0.75rem;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
.source-chip {
  background: #e8f1ff;
  color: #1d4ed8;
}
</style>
