<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BranchService, { type Branch, type BranchCompany, BRANCH_COMPANY_LABELS } from '@/services/branch.service'
import { useBranches } from '@/composables/useBranches'

const { load: reloadCache } = useBranches()

const branches = ref<Branch[]>([])
const isLoading = ref(false)
const successMsg = ref('')
const errorMsg = ref('')
const showAddModal = ref(false)
const isSaving = ref(false)
const deletingId = ref<string | null>(null)

// Add form
const addName = ref('')
const addSortOrder = ref(0)
const addCompany = ref<BranchCompany>('nicole')
const companyOptions = Object.entries(BRANCH_COMPANY_LABELS) as [BranchCompany, string][]
const companyLabel = (c?: BranchCompany) => BRANCH_COMPANY_LABELS[c || 'nicole']

// Edit
const editingId = ref<string | null>(null)
const editName = ref('')
const editIsActive = ref(true)
const editSortOrder = ref(0)
const editCompany = ref<BranchCompany>('nicole')

const activeCount = computed(() => branches.value.filter(b => b.isActive).length)
const inactiveCount = computed(() => branches.value.filter(b => !b.isActive).length)

const showSuccess = (msg: string) => {
  successMsg.value = msg; errorMsg.value = ''
  setTimeout(() => { successMsg.value = '' }, 3000)
}
const showError = (msg: string) => {
  errorMsg.value = msg; successMsg.value = ''
  setTimeout(() => { errorMsg.value = '' }, 4000)
}

const load = async () => {
  isLoading.value = true
  try { branches.value = await BranchService.getBranches() }
  catch { showError('No se pudieron cargar los puntos de venta.') }
  finally { isLoading.value = false }
}

const openAdd = () => {
  addName.value = ''
  addSortOrder.value = branches.value.length
  addCompany.value = 'nicole'
  showAddModal.value = true
}

const handleAdd = async () => {
  if (!addName.value.trim()) return
  isSaving.value = true
  try {
    await BranchService.createBranch({ name: addName.value.trim(), isActive: true, sortOrder: addSortOrder.value, company: addCompany.value })
    showAddModal.value = false
    showSuccess(`"${addName.value.trim()}" agregado correctamente.`)
    await load(); await reloadCache(true)
  } catch (e: any) {
    showError(e?.data?.message || 'Error al crear el punto de venta.')
  } finally { isSaving.value = false }
}

const startEdit = (b: Branch) => {
  editingId.value = b._id; editName.value = b.name
  editIsActive.value = b.isActive; editSortOrder.value = b.sortOrder
  editCompany.value = b.company || 'nicole'
}
const cancelEdit = () => { editingId.value = null }

const handleUpdate = async (id: string) => {
  if (!editName.value.trim()) return
  isSaving.value = true
  try {
    const current = branches.value.find(b => b._id === id)
    const payload: Parameters<typeof BranchService.updateBranch>[1] = {
      isActive: editIsActive.value, sortOrder: editSortOrder.value, company: editCompany.value,
    }
    // Solo se manda el nombre si cambió: el back no deja renombrar una sucursal con historial.
    if (editName.value.trim() !== current?.name) payload.name = editName.value.trim()
    await BranchService.updateBranch(id, payload)
    editingId.value = null
    showSuccess('Punto de venta actualizado.')
    await load(); await reloadCache(true)
  } catch (e: any) {
    showError(e?.data?.message || 'Error al actualizar.')
  } finally { isSaving.value = false }
}

const handleDelete = async (id: string) => {
  if (deletingId.value !== id) {
    deletingId.value = id
    setTimeout(() => { if (deletingId.value === id) deletingId.value = null }, 3000)
    return
  }
  try {
    const name = branches.value.find(b => b._id === id)?.name
    const result = await BranchService.deleteBranch(id)
    deletingId.value = null
    showSuccess(result.deactivated
      ? `"${name}" tiene historial: quedó desactivado, no borrado.`
      : `"${name}" eliminado.`)
    await load(); await reloadCache(true)
  } catch (e: any) { showError(e?.data?.message || 'Error al eliminar.') }
}

onMounted(load)
</script>

<template>
  <div class="branch-view">

    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="gradient-title">Puntos de Venta</h1>
        <p class="subtitle">Sucursales, islas y locales activos en el sistema. Todos los módulos los usan automáticamente.</p>

        <!-- Stats chips -->
        <div class="stats-row">
          <span class="chip chip--total">
            <i class="fa-solid fa-store"></i> {{ branches.length }} totales
          </span>
          <span class="chip chip--active">
            <i class="fa-solid fa-circle-check"></i> {{ activeCount }} activos
          </span>
          <span v-if="inactiveCount" class="chip chip--inactive">
            <i class="fa-solid fa-circle-xmark"></i> {{ inactiveCount }} inactivos
          </span>
        </div>
      </div>

      <button class="btn-add" @click="openAdd">
        <span class="btn-icon"><i class="fa-solid fa-plus"></i></span>
        Agregar Punto
      </button>
    </div>

    <!-- Notifications -->
    <Transition name="notif">
      <div v-if="successMsg" class="notif notif--success">
        <i class="fa-solid fa-circle-check"></i> {{ successMsg }}
      </div>
    </Transition>
    <Transition name="notif">
      <div v-if="errorMsg" class="notif notif--error">
        <i class="fa-solid fa-triangle-exclamation"></i> {{ errorMsg }}
      </div>
    </Transition>

    <!-- Usage info banner -->
    <div class="usage-banner">
      <div class="usage-item">
        <i class="fa-solid fa-basket-shopping"></i>
        <div>
          <strong>Pedidos</strong>
          <span>Sucursal de origen y punto de retiro</span>
        </div>
      </div>
      <div class="usage-sep"></div>
      <div class="usage-item">
        <i class="fa-solid fa-rotate"></i>
        <div>
          <strong>Restock</strong>
          <span>Configuración de stock por local</span>
        </div>
      </div>
      <div class="usage-sep"></div>
      <div class="usage-item">
        <i class="fa-solid fa-industry"></i>
        <div>
          <strong>Producción</strong>
          <span>Agrupación por destino</span>
        </div>
      </div>
      <div class="usage-sep"></div>
      <div class="usage-item">
        <i class="fa-solid fa-receipt"></i>
        <div>
          <strong>Facturación</strong>
          <span>Isla donde se registró la venta</span>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Cargando puntos de venta...</span>
    </div>

    <!-- Cards grid -->
    <div v-else-if="branches.length" class="branches-grid">
      <div
        v-for="b in branches"
        :key="b._id"
        class="branch-card"
        :class="{ 'card--editing': editingId === b._id, 'card--inactive': !b.isActive && editingId !== b._id }"
      >
        <!-- View mode -->
        <template v-if="editingId !== b._id">
          <div class="card-top">
            <div class="branch-icon" :class="b.isActive ? 'icon--active' : 'icon--inactive'">
              <i class="fa-solid fa-store"></i>
            </div>
            <div class="card-badges">
              <span class="status-pill" :class="b.isActive ? 'pill--active' : 'pill--inactive'">
                {{ b.isActive ? 'Activo' : 'Inactivo' }}
              </span>
              <span class="order-pill">#{{ b.sortOrder }}</span>
              <span class="company-pill" :class="`company--${b.company || 'nicole'}`">{{ companyLabel(b.company) }}</span>
            </div>
          </div>
          <h3 class="branch-name">{{ b.name }}</h3>
          <p class="branch-meta">Disponible en todos los módulos del sistema</p>
          <div class="card-actions">
            <button class="card-btn card-btn--edit" @click="startEdit(b)">
              <i class="fa-solid fa-pen"></i> Editar
            </button>
            <button
              class="card-btn"
              :class="deletingId === b._id ? 'card-btn--confirm' : 'card-btn--delete'"
              @click="handleDelete(b._id)"
            >
              <i class="fa-solid" :class="deletingId === b._id ? 'fa-triangle-exclamation' : 'fa-trash'"></i>
              {{ deletingId === b._id ? '¿Confirmar?' : 'Eliminar' }}
            </button>
          </div>
        </template>

        <!-- Edit mode -->
        <template v-else>
          <div class="edit-header">
            <i class="fa-solid fa-pen-to-square"></i> Editando punto
          </div>
          <div class="edit-fields">
            <div class="edit-field">
              <label>Nombre</label>
              <input v-model="editName" type="text" class="edit-input" @keyup.enter="handleUpdate(b._id)" />
            </div>
            <div class="edit-field edit-field--sm">
              <label>Orden</label>
              <input v-model.number="editSortOrder" type="number" min="0" class="edit-input" />
            </div>
          </div>
          <div class="edit-field">
            <label>Empresa</label>
            <select v-model="editCompany" class="edit-input">
              <option v-for="[value, label] in companyOptions" :key="value" :value="value">{{ label }}</option>
            </select>
          </div>
          <p class="field-hint">Con pedidos o cierres guardados, el nombre ya no se puede cambiar.</p>
          <label class="toggle">
            <input type="checkbox" v-model="editIsActive" />
            <span class="track"></span>
            <span class="toggle-label">{{ editIsActive ? 'Activo' : 'Inactivo' }}</span>
          </label>
          <div class="edit-actions">
            <button class="card-btn card-btn--cancel" @click="cancelEdit">Cancelar</button>
            <button class="card-btn card-btn--save" :disabled="isSaving || !editName.trim()" @click="handleUpdate(b._id)">
              <i v-if="isSaving" class="fa-solid fa-spinner fa-spin"></i>
              <span v-else><i class="fa-solid fa-check"></i> Guardar</span>
            </button>
          </div>
        </template>
      </div>

      <!-- Add placeholder card -->
      <button class="add-card" @click="openAdd">
        <i class="fa-solid fa-plus"></i>
        <span>Agregar nuevo punto de venta</span>
      </button>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <div class="empty-icon"><i class="fa-solid fa-store-slash"></i></div>
      <h3>Sin puntos de venta</h3>
      <p>Agrega tu primera sucursal y estará disponible en todos los módulos del sistema.</p>
      <button class="btn-add" @click="openAdd">
        <span class="btn-icon"><i class="fa-solid fa-plus"></i></span>
        Agregar primer punto
      </button>
    </div>

    <!-- Add Modal -->
    <Transition name="modal">
      <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
        <div class="modal-box">
          <div class="modal-header">
            <div class="modal-icon"><i class="fa-solid fa-store"></i></div>
            <div>
              <h2>Nuevo Punto de Venta</h2>
              <p>Disponible inmediatamente en pedidos, restock, producción y más.</p>
            </div>
            <button class="modal-close" @click="showAddModal = false">&times;</button>
          </div>

          <div class="modal-body">
            <div class="modal-field">
              <label>Nombre del Punto <span class="req">*</span></label>
              <input
                v-model="addName"
                type="text"
                placeholder="Ej: Entre Ríos, Urdesa, Kennedy..."
                class="modal-input"
                @keyup.enter="handleAdd"
                autofocus
              />
            </div>
            <div class="modal-field">
              <label>Empresa <span class="req">*</span></label>
              <select v-model="addCompany" class="modal-input">
                <option v-for="[value, label] in companyOptions" :key="value" :value="value">{{ label }}</option>
              </select>
              <span class="field-hint">A qué razón social pertenece el local (para separar la contabilidad).</span>
            </div>
            <div class="modal-field modal-field--sm">
              <label>Posición en lista</label>
              <input v-model.number="addSortOrder" type="number" min="0" class="modal-input" />
              <span class="field-hint">Número más bajo = aparece primero</span>
            </div>
          </div>

          <div class="modal-footer">
            <button class="modal-btn modal-btn--cancel" @click="showAddModal = false">Cancelar</button>
            <button class="modal-btn modal-btn--save" :disabled="!addName.trim() || isSaving" @click="handleAdd">
              <i v-if="isSaving" class="fa-solid fa-spinner fa-spin"></i>
              <span v-else>Agregar Punto de Venta</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.branch-view {
  padding: 3rem 2rem;
  max-width: 1300px;
  min-height: 100vh;
}

// ─── Header ─────────────────────────────────────────────────────────────────
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2.5rem;
  gap: 2rem;
  flex-wrap: wrap;
}

.gradient-title {
  background: linear-gradient(135deg, $NICOLE-PURPLE, #7c3aed);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: $font-principal;
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0 0 0.4rem;
  letter-spacing: -1px;
}

.subtitle {
  color: #64748b;
  font-size: 1rem;
  margin: 0 0 1rem;
  max-width: 520px;
  line-height: 1.5;
}

.stats-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;

  &--total   { background: #f1f5f9; color: #475569; }
  &--active  { background: #dcfce7; color: #166534; }
  &--inactive{ background: #fef3c7; color: #92400e; }
}

// ─── Add button ──────────────────────────────────────────────────────────────
.btn-add {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.5rem 1.5rem 0.5rem 0.5rem;
  border-radius: 50px;
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 20px rgba($NICOLE-PURPLE, 0.2);
  white-space: nowrap;

  .btn-icon {
    width: 32px; height: 32px;
    background: rgba(255,255,255,0.2);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 15px 25px rgba($NICOLE-PURPLE, 0.3);
  }
}

// ─── Notifications ──────────────────────────────────────────────────────────
.notif {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1.25rem;
  border-radius: 12px;
  margin-bottom: 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;

  &--success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
  &--error   { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
}

// ─── Usage banner ───────────────────────────────────────────────────────────
.usage-banner {
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid $border-light;
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 2rem;
  gap: 0;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.usage-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 140px;

  > i {
    width: 36px; height: 36px;
    background: rgba($NICOLE-PURPLE, 0.08);
    color: $NICOLE-PURPLE;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  > div {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;

    strong {
      font-size: 0.82rem;
      font-weight: 700;
      color: $text-dark;
    }

    span {
      font-size: 0.75rem;
      color: $text-light;
    }
  }
}

.usage-sep {
  width: 1px;
  height: 36px;
  background: $border-light;
  flex-shrink: 0;

  @media (max-width: 640px) { display: none; }
}

// ─── Grid ────────────────────────────────────────────────────────────────────
.branches-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}

// ─── Branch card ─────────────────────────────────────────────────────────────
.branch-card {
  background: white;
  border: 1px solid $border-light;
  border-radius: 18px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);

  &:hover:not(.card--editing) {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    border-color: rgba($NICOLE-PURPLE, 0.25);
  }

  &.card--inactive {
    opacity: 0.6;
    filter: grayscale(20%);
  }

  &.card--editing {
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
  }
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.branch-icon {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem;

  &.icon--active   { background: rgba($NICOLE-PURPLE, 0.1); color: $NICOLE-PURPLE; }
  &.icon--inactive { background: $gray-100; color: #94a3b8; }
}

.card-badges {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.status-pill {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  letter-spacing: 0.3px;

  &.pill--active   { background: #dcfce7; color: #166534; }
  &.pill--inactive { background: $gray-100; color: #64748b; }
}

.order-pill {
  font-size: 0.68rem;
  font-weight: 600;
  color: $text-light;
  background: $gray-100;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
}

.company-pill {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;

  &.company--nicole { background: #fce7f3; color: #9d174d; }
  &.company--sucree { background: #fef3c7; color: #92400e; }
}

.branch-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: $text-dark;
  margin: 0;
  line-height: 1.3;
}

.branch-meta {
  font-size: 0.78rem;
  color: $text-light;
  margin: 0;
  flex-grow: 1;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

// ─── Edit mode inside card ────────────────────────────────────────────────────
.edit-header {
  font-size: 0.78rem;
  font-weight: 700;
  color: $NICOLE-PURPLE;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.edit-fields {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;

  &--sm { flex: 0 0 72px; }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    color: $text-light;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
}

.edit-input {
  border: 1px solid $border-light;
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  font-size: 0.875rem;
  color: $text-dark;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &:focus { border-color: $NICOLE-PURPLE; }
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

// ─── Toggle ──────────────────────────────────────────────────────────────────
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;

  input { display: none; }

  .track {
    width: 34px; height: 18px;
    border-radius: 9px;
    background: #e2e8f0;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;

    &::after {
      content: '';
      position: absolute;
      top: 2px; left: 2px;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: white;
      transition: transform 0.2s;
    }
  }

  input:checked ~ .track {
    background: $NICOLE-PURPLE;
    &::after { transform: translateX(16px); }
  }

  .toggle-label { font-size: 0.8rem; color: $text-dark; }
}

// ─── Card buttons ─────────────────────────────────────────────────────────────
.card-btn {
  flex: 1;
  border: none;
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;

  &--edit    { background: $gray-100; color: $text-dark; &:hover { background: $NICOLE-PURPLE; color: white; } }
  &--delete  { background: #fef2f2; color: #dc2626; &:hover { background: #fee2e2; } }
  &--confirm { background: #dc2626; color: white; animation: pulse 0.4s ease; }
  &--save    { background: $NICOLE-PURPLE; color: white; &:disabled { opacity: 0.5; cursor: not-allowed; } }
  &--cancel  { background: $gray-100; color: $text-light; flex: 0 0 auto; padding: 0.5rem 0.9rem; }
}

// ─── Add placeholder card ─────────────────────────────────────────────────────
.add-card {
  border: 2px dashed $border-light;
  border-radius: 18px;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 2rem;
  color: $text-light;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  min-height: 160px;

  i { font-size: 1.5rem; opacity: 0.4; }

  &:hover {
    border-color: $NICOLE-PURPLE;
    color: $NICOLE-PURPLE;
    background: rgba($NICOLE-PURPLE, 0.02);

    i { opacity: 0.7; }
  }
}

// ─── States ───────────────────────────────────────────────────────────────────
.loading-state {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
  color: $text-light;
  font-size: 0.9rem;

  .spinner {
    width: 28px; height: 28px;
    border: 3px solid rgba($NICOLE-PURPLE, 0.2);
    border-radius: 50%;
    border-top-color: $NICOLE-PURPLE;
    animation: spin 0.9s ease infinite;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rem 2rem;
  gap: 1rem;
  text-align: center;

  .empty-icon {
    width: 80px; height: 80px;
    background: $gray-100;
    border-radius: 24px;
    display: flex; align-items: center; justify-content: center;
    i { font-size: 2rem; color: #cbd5e1; }
  }

  h3 { font-size: 1.25rem; font-weight: 700; color: $text-dark; margin: 0; }
  p  { font-size: 0.9rem; color: $text-light; margin: 0; max-width: 360px; line-height: 1.5; }
}

// ─── Modal ────────────────────────────────────────────────────────────────────
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-box {
  background: white;
  border-radius: 24px;
  width: 100%;
  max-width: 460px;
  box-shadow: 0 25px 60px rgba(0,0,0,0.2);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.75rem 1.75rem 1.25rem;
  border-bottom: 1px solid $gray-100;

  .modal-icon {
    width: 46px; height: 46px;
    background: rgba($NICOLE-PURPLE, 0.1);
    color: $NICOLE-PURPLE;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: $text-dark;
    margin: 0 0 0.2rem;
    font-family: $font-principal;
  }

  p {
    font-size: 0.82rem;
    color: $text-light;
    margin: 0;
    line-height: 1.4;
  }

  .modal-close {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 1.5rem;
    color: $text-light;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    flex-shrink: 0;
    &:hover { color: $text-dark; }
  }
}

.modal-body {
  padding: 1.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &--sm { max-width: 120px; }

  label {
    font-size: 0.78rem;
    font-weight: 700;
    color: $text-dark;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    .req { color: #ef4444; }
  }
}

.modal-input {
  border: 1.5px solid $border-light;
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  font-size: 0.95rem;
  color: $text-dark;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    border-color: $NICOLE-PURPLE;
    box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
  }
}

.field-hint {
  font-size: 0.73rem;
  color: $text-light;
}

.modal-footer {
  padding: 1.25rem 1.75rem;
  border-top: 1px solid $gray-100;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.modal-btn {
  border: none;
  border-radius: 12px;
  padding: 0.7rem 1.4rem;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;

  &--cancel {
    background: $gray-100;
    color: $text-dark;
    &:hover { background: $gray-200; }
  }

  &--save {
    background: $NICOLE-PURPLE;
    color: white;
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.3);
    &:hover { background: $purple-hover; transform: translateY(-1px); }
    &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
  }
}

// ─── Animations ───────────────────────────────────────────────────────────────
.notif-enter-active, .notif-leave-active { transition: all 0.3s ease; }
.notif-enter-from, .notif-leave-to { opacity: 0; transform: translateY(-6px); }

.modal-enter-active, .modal-leave-active { transition: all 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; .modal-box { transform: scale(0.95) translateY(10px); } }

@keyframes spin   { to { transform: rotate(360deg); } }
@keyframes pulse  { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
</style>
