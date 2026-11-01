<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useBranches } from '@/composables/useBranches'
import { useToast } from '@/composables/useToast'
import { posRestockService, type InitialInventory, type InitialInventoryItem } from '@/services/pos-restock.service'
import { getECTTodayString } from '@/utils/dateUtils'

/**
 * Inventario inicial (Operaciones): con cuánto EMPEZÓ cada producto en una sucursal un día.
 * Sirve cuando no hubo cierre el día anterior (sucursal nueva, un día sin cierre) o para
 * corregir el punto de partida. En Descuadres y Detalle del Día manda sobre el cierre anterior.
 */
const { branchNames, load: loadBranches } = useBranches()
const { success, error: showError } = useToast()

const branch = ref('')
const date = ref(getECTTodayString())
const inventory = ref<InitialInventory | null>(null)
const items = ref<InitialInventoryItem[]>([])
const note = ref('')
const loading = ref(false)
const saving = ref(false)
const search = ref('')
const newName = ref('')
const newUnit = ref('unidad')

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const visible = computed(() =>
  items.value
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !search.value || norm(item.productName).includes(norm(search.value)))
)
const totalUnits = computed(() => items.value.reduce((s, i) => s + (Number(i.quantity) || 0), 0))

async function load() {
  if (!branch.value || !date.value) return
  loading.value = true
  try {
    const data = await posRestockService.getInitialInventory(branch.value, date.value)
    inventory.value = data
    items.value = data.items.map((i) => ({ ...i }))
    note.value = data.note || ''
  } catch (e: any) {
    showError(e?.data?.message || 'No se pudo cargar el inventario')
  } finally {
    loading.value = false
  }
}

function addProduct() {
  const name = newName.value.trim()
  if (!name) return
  if (items.value.some((i) => norm(i.productName) === norm(name))) {
    showError('Ese producto ya está en la lista')
    return
  }
  items.value.push({ productName: name, unit: newUnit.value.trim() || 'unidad', quantity: 0 })
  newName.value = ''
}

function removeProduct(index: number) {
  items.value.splice(index, 1)
}

async function save() {
  saving.value = true
  try {
    await posRestockService.saveInitialInventory({
      branch: branch.value,
      date: date.value,
      items: items.value.map((i) => ({ ...i, quantity: Number(i.quantity) || 0 })),
      note: note.value.trim() || undefined,
    })
    success('Inventario inicial guardado')
    await load()
  } catch (e: any) {
    showError(e?.data?.message || e?.message || 'No se pudo guardar')
  } finally {
    saving.value = false
  }
}

watch([branch, date], load)
onMounted(async () => {
  await loadBranches()
  if (!branch.value && branchNames.value.length) branch.value = branchNames.value[0]!
})

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' }) : ''
</script>

<template>
  <div class="inv-page">
    <header class="inv-head">
      <div>
        <h1><i class="fa-solid fa-boxes-stacked"></i> Inventario inicial</h1>
        <p>
          Con cuánto <strong>empezó</strong> cada producto en la sucursal ese día. Úsalo cuando no hubo cierre el
          día anterior o para corregir el punto de partida: en Descuadres y Detalle del Día este conteo manda.
        </p>
      </div>
    </header>

    <section class="inv-filters">
      <label>
        <span>Sucursal</span>
        <select v-model="branch">
          <option v-for="b in branchNames" :key="b" :value="b">{{ b }}</option>
        </select>
      </label>
      <label>
        <span>Día</span>
        <input v-model="date" type="date" />
      </label>
    </section>

    <div v-if="loading" class="inv-muted"><i class="fa-solid fa-spinner fa-spin"></i> Cargando…</div>

    <template v-else-if="inventory">
      <p v-if="inventory.exists" class="inv-status inv-status--ok">
        <i class="fa-solid fa-circle-check"></i>
        Ya registrado por {{ inventory.updatedBy || inventory.createdBy }} · {{ fmtDate(inventory.updatedAt) }}.
        Puedes corregirlo y volver a guardar.
      </p>
      <p v-else class="inv-status">
        <i class="fa-solid fa-circle-info"></i>
        Todavía no hay inventario inicial para este día.
        <template v-if="inventory.suggestedFromClosing">Las cantidades vienen del cierre del día anterior: revísalas.</template>
        <template v-else>No hubo cierre el día anterior: cuenta cada producto.</template>
      </p>

      <div class="inv-tools">
        <div class="inv-search">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input v-model="search" type="text" placeholder="Buscar producto…" />
        </div>
        <span class="inv-muted">{{ items.length }} productos · {{ totalUnits }} unidades</span>
      </div>

      <div class="inv-table">
        <div class="inv-row inv-row--head">
          <span>Producto</span>
          <span>Unidad</span>
          <span>Cantidad</span>
          <span></span>
        </div>
        <div v-for="{ item, index } in visible" :key="item.productName" class="inv-row">
          <span class="inv-name">{{ item.productName }}</span>
          <span class="inv-unit">{{ item.unit }}</span>
          <input v-model.number="item.quantity" type="number" min="0" step="1" inputmode="numeric" class="inv-qty" />
          <button class="inv-remove" title="Quitar" @click="removeProduct(index)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <p v-if="!items.length" class="inv-muted inv-empty">
          No hay productos configurados para esta sucursal. Agrégalos abajo.
        </p>
      </div>

      <form class="inv-add" @submit.prevent="addProduct">
        <input v-model="newName" type="text" placeholder="Agregar producto (nombre como en el cierre)" />
        <input v-model="newUnit" type="text" placeholder="Unidad" class="inv-add__unit" />
        <button type="submit" class="btn btn--ghost"><i class="fa-solid fa-plus"></i> Agregar</button>
      </form>

      <label class="inv-note">
        <span>Nota (opcional)</span>
        <input v-model="note" type="text" maxlength="200" placeholder="Ej.: apertura de la isla, conteo hecho por…" />
      </label>

      <div class="inv-actions">
        <button class="btn btn--primary" :disabled="saving || !items.length" @click="save">
          <i :class="saving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-floppy-disk'"></i>
          {{ inventory.exists ? 'Guardar cambios' : 'Guardar inventario inicial' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.inv-page {
  padding: 1.5rem;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.inv-head {
  h1 { margin: 0 0 0.4rem; font-size: 1.5rem; color: #490f57; display: flex; gap: 0.5rem; align-items: center; }
  p { margin: 0; color: #4b4453; line-height: 1.5; }
}

.inv-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;

  label { display: flex; flex-direction: column; gap: 0.3rem; font-weight: 600; font-size: 0.85rem; color: #2d2433; flex: 1 1 200px; }
  select, input { padding: 0.65rem 0.75rem; border: 1px solid #ddd3e3; border-radius: 10px; font-size: 0.95rem; background: #fff; }
}

.inv-status {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: #fef9c3;
  color: #713f12;
  font-size: 0.9rem;

  &--ok { background: #dcfce7; color: #14532d; }
}

.inv-tools { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

.inv-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd3e3;
  border-radius: 10px;
  background: #fff;
  flex: 1 1 260px;

  input { border: none; outline: none; flex: 1; font-size: 0.95rem; }
  i { color: #8a8193; }
}

.inv-muted { color: #6b6475; font-size: 0.88rem; }

.inv-table {
  background: #fff;
  border: 1px solid #ece7ef;
  border-radius: 14px;
  overflow: hidden;
}

.inv-row {
  display: grid;
  grid-template-columns: 1fr 90px 110px 40px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid #f3eff5;

  &--head { background: #faf5fb; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b6475; }
}

.inv-name { font-weight: 600; color: #2d2433; }
.inv-unit { color: #6b6475; font-size: 0.85rem; }

.inv-qty {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd3e3;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  text-align: center;
}

.inv-remove { background: none; border: none; color: #b91c1c; cursor: pointer; font-size: 1rem; }
.inv-empty { padding: 1rem; margin: 0; }

.inv-add {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;

  input { flex: 1 1 240px; padding: 0.6rem 0.75rem; border: 1px solid #ddd3e3; border-radius: 10px; }
  &__unit { flex: 0 1 120px !important; }
}

.inv-note {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-weight: 600;
  font-size: 0.85rem;

  input { padding: 0.6rem 0.75rem; border: 1px solid #ddd3e3; border-radius: 10px; font-weight: 400; }
}

.inv-actions { display: flex; justify-content: flex-end; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.75rem 1.2rem;
  border-radius: 10px;
  border: none;
  font-weight: 700;
  cursor: pointer;

  &--primary { background: #490f57; color: #fff; }
  &--primary:disabled { opacity: 0.6; cursor: not-allowed; }
  &--ghost { background: #fff; color: #490f57; border: 1px solid #ddd3e3; }
}

@media (max-width: 600px) {
  .inv-row { grid-template-columns: 1fr 90px 36px; }
  .inv-unit { display: none; }
}
</style>
