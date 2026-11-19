<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  inventoryService,
  type InventoryBlock,
  type InventoryCatalog,
  type InventoryCompany,
  type InventoryCountItem,
  type InventoryProductBlock,
  type InventoryWeek,
} from '@/services/inventory.service'
import { compressPhoto } from './inventoryPhoto'

/**
 * Toma de inventario. La usan Producción y el Jefe de Operaciones.
 * - Utensilios: columnas de las tomas anteriores + la vigente; todo utensilio nuevo lleva foto.
 * - Productos: producto terminado, en proceso y materia prima.
 * Se puede pasar de un bloque a otro sin cerrarlo. El mismo día de la toma, un bloque cerrado se
 * puede reabrir para corregir. Desde la medianoche la toma queda bloqueada (también lo que quedó
 * abierto) y se empieza una nueva con el botón "Nueva toma de inventario".
 * Cada cambio se guarda solo, unos segundos después.
 */

const RESPONSIBLES = ['Ricardo']
const PRODUCT_BLOCKS: InventoryProductBlock[] = ['pt', 'pp', 'mp']

const company = ref<InventoryCompany>('nicole')
const responsible = ref(RESPONSIBLES[0]!)
const screen = ref<'home' | 'ut' | 'products'>('home')
const block = ref<InventoryProductBlock>('pt')

const week = ref<InventoryWeek | null>(null)
const catalog = ref<InventoryCatalog | null>(null)
const loading = ref(true)
const loadError = ref('')

// Lo que se está contando (copia local que se guarda sola)
const productItems = ref<Record<InventoryProductBlock, InventoryCountItem[]>>({ pt: [], pp: [], mp: [] })
const utCounts = ref<Record<string, number | null>>({})

const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const saveError = ref('')
const timers: Partial<Record<InventoryBlock, ReturnType<typeof setTimeout>>> = {}
/** Empresa a la que pertenece cada guardado pendiente (por si cambian de empresa antes de guardar). */
const timerCompany: Partial<Record<InventoryBlock, InventoryCompany>> = {}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [w, c] = await Promise.all([
      inventoryService.getWeek(company.value),
      inventoryService.getCatalog(company.value),
    ])
    week.value = w
    catalog.value = c
    if (w.count.responsible && RESPONSIBLES.includes(w.count.responsible)) responsible.value = w.count.responsible
    syncFromServer()
  } catch (e: any) {
    loadError.value = e?.message || 'No se pudo cargar el inventario. Revisa el internet.'
  } finally {
    loading.value = false
  }
}

function syncFromServer() {
  const c = week.value?.count
  if (!c) return
  productItems.value = { pt: c.pt.items.map(i => ({ ...i })), pp: c.pp.items.map(i => ({ ...i })), mp: c.mp.items.map(i => ({ ...i })) }
  const counts: Record<string, number | null> = {}
  for (const u of week.value!.utensils) counts[u.id] = null
  for (const i of c.ut.items) counts[i.utensilId] = i.quantity
  utCounts.value = counts
}

watch(company, () => {
  flushAll()
  load()
})

const weekLabel = computed(() => {
  const iso = week.value?.weekOf
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})
const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const statusOf = (k: InventoryBlock) => week.value?.count[k].status || 'open'
const isClosed = (k: InventoryBlock) => statusOf(k) === 'closed'
/** La toma es de un día anterior: ya no se modifica (pasó la medianoche del día de la toma). */
const locked = computed(() => !!week.value && !week.value.editable)
/** El bloque no se puede editar: está cerrado o la toma ya está bloqueada. */
const readOnly = (k: InventoryBlock) => locked.value || isClosed(k)
const countedIn = (k: InventoryBlock) =>
  k === 'ut' ? Object.values(utCounts.value).filter(v => v != null).length : productItems.value[k].length
const pillOf = (k: InventoryBlock) =>
  isClosed(k) ? 'closed' : locked.value ? 'locked' : countedIn(k) ? 'open' : 'pending'
const PILL_TEXT = { closed: '✓ Cerrado', open: '● En curso', pending: 'Pendiente', locked: '🔒 Bloqueado' }
const hourOf = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guayaquil' }) : ''
/** "Cerrado a las 10:05 por Ricardo · se reabrió a las 15:00" */
function closedInfo(k: InventoryBlock) {
  const b = week.value?.count[k]
  if (!b) return ''
  let t = b.closedAt ? `a las ${hourOf(b.closedAt)}` : ''
  if (b.closedBy) t += ` por ${b.closedBy}`
  if (b.reopenedAt) t += ` · se reabrió a las ${hourOf(b.reopenedAt)}`
  return t
}

const blockTitle = (k: InventoryProductBlock) => catalog.value?.blocks.find(b => b.key === k)?.title || k
const lastCountLabel = computed(() => {
  const h = week.value?.history
  return h && h.length ? shortDate(h[h.length - 1]!.weekOf) : 'sin conteos anteriores'
})

// ───────────── Guardado automático ─────────────
function scheduleSave(k: InventoryBlock) {
  if (readOnly(k)) return
  if (timers[k]) clearTimeout(timers[k])
  saveState.value = 'saving'
  timerCompany[k] = company.value
  timers[k] = setTimeout(() => saveNow(k), 800)
}

async function saveNow(k: InventoryBlock) {
  if (timers[k]) clearTimeout(timers[k])
  delete timers[k]
  const comp = timerCompany[k] ?? company.value
  delete timerCompany[k]
  if (!week.value || readOnly(k)) return
  saveState.value = 'saving'
  saveError.value = ''
  try {
    const items =
      k === 'ut'
        ? Object.entries(utCounts.value)
            .filter(([, q]) => q != null)
            .map(([utensilId, quantity]) => ({ utensilId, quantity: quantity as number }))
        : productItems.value[k].map(i => ({ code: i.code, quantity: i.quantity, unit: i.unit }))
    const count = await inventoryService.saveBlock(k, { company: comp, responsible: responsible.value, items })
    if (week.value && comp === company.value) week.value.count = count
    saveState.value = 'saved'
  } catch (e: any) {
    saveState.value = 'error'
    saveError.value = e?.message || 'No se pudo guardar. Revisa el internet.'
  }
}

function flushAll() {
  for (const k of Object.keys(timers) as InventoryBlock[]) saveNow(k)
}

watch(responsible, () => {
  // El responsable se guarda junto con cualquier bloque abierto
  const k: InventoryBlock = screen.value === 'ut' ? 'ut' : block.value
  if (!readOnly(k)) scheduleSave(k)
})

const closing = ref(false)
async function closeBlock(k: InventoryBlock) {
  if (!week.value) return
  closing.value = true
  try {
    await saveNow(k)
    if (saveState.value === 'error') return
    week.value.count = await inventoryService.closeBlock(k, company.value)
  } catch (e: any) {
    saveState.value = 'error'
    saveError.value = e?.message || 'No se pudo cerrar el bloque.'
  } finally {
    closing.value = false
  }
}

const reopening = ref(false)
/** Reabre un bloque cerrado para corregirlo (solo el mismo día de la toma). */
async function reopenBlock(k: InventoryBlock) {
  if (!week.value || locked.value) return
  reopening.value = true
  saveError.value = ''
  try {
    week.value.count = await inventoryService.reopenBlock(k, company.value)
    syncFromServer()
  } catch (e: any) {
    saveState.value = 'error'
    saveError.value = e?.message || 'No se pudo reabrir el bloque.'
    load()
  } finally {
    reopening.value = false
  }
}

const starting = ref(false)
/** Empieza una toma nueva hoy: la anterior pasa a ser historial. */
async function startNew() {
  if (!week.value || !week.value.canStartNew) return
  starting.value = true
  saveError.value = ''
  try {
    week.value = await inventoryService.startNew(company.value)
    syncFromServer()
    saveState.value = 'idle'
  } catch (e: any) {
    saveState.value = 'error'
    saveError.value = e?.message || 'No se pudo empezar la nueva toma.'
  } finally {
    starting.value = false
  }
}

// ───────────── Productos ─────────────
const currentBlock = computed(() => catalog.value?.blocks.find(b => b.key === block.value))
const categories = computed(() => currentBlock.value?.categories.map(c => c.name) || [])
const category = ref('')
const productCode = ref('')
const quantity = ref('')
const unit = ref('')

watch([categories, block], () => {
  if (!categories.value.includes(category.value)) category.value = categories.value[0] || ''
  productCode.value = ''
}, { immediate: true })

const productsInCategory = computed(
  () => currentBlock.value?.categories.find(c => c.name === category.value)?.products || [],
)
watch(productCode, code => {
  const p = productsInCategory.value.find(x => x.code === code)
  if (p) unit.value = p.unit
})

const parsedQty = computed(() => {
  const n = Number(String(quantity.value).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && String(quantity.value).trim() !== '' ? n : null
})
const canAdd = computed(() => !!productCode.value && parsedQty.value != null && !readOnly(block.value))

function addProduct() {
  const p = productsInCategory.value.find(x => x.code === productCode.value)
  if (!p || parsedQty.value == null) return
  const u = unit.value || p.unit
  const list = productItems.value[block.value]
  const existing = list.find(i => i.code === p.code && i.unit === u)
  if (existing) existing.quantity = Math.round((existing.quantity + parsedQty.value) * 1000) / 1000
  else list.push({ code: p.code, name: p.name, category: category.value, quantity: parsedQty.value, unit: u })
  productCode.value = ''
  quantity.value = ''
  scheduleSave(block.value)
}

function removeProduct(ix: number) {
  productItems.value[block.value].splice(ix, 1)
  scheduleSave(block.value)
}

function goBlock(k: InventoryProductBlock) {
  if (timers[block.value]) saveNow(block.value)
  block.value = k
}

// ───────────── Utensilios ─────────────
const history = computed(() => week.value?.history || [])
function prevOf(id: string): number | null {
  for (let i = history.value.length - 1; i >= 0; i--) {
    const v = history.value[i]!.utensils[id]
    if (v != null) return v
  }
  return null
}
function diffOf(id: string): number | null {
  const now = utCounts.value[id]
  const prev = prevOf(id)
  return now == null || prev == null || now === prev ? null : now - prev
}
const missingUt = computed(() => Object.values(utCounts.value).filter(v => v == null).length)

function incUt(id: string, d: number) {
  utCounts.value[id] = Math.max(0, (utCounts.value[id] ?? 0) + d)
  scheduleSave('ut')
}
function setUt(id: string, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  const n = parseInt(raw, 10)
  utCounts.value[id] = raw === '' || !Number.isFinite(n) ? null : Math.max(0, n)
  scheduleSave('ut')
}

const newName = ref('')
const newQty = ref('')
const newPhoto = ref<string | null>(null)
const addingUt = ref(false)
const utError = ref('')
const canAddUt = computed(
  () => !!newName.value.trim() && /^\d+$/.test(newQty.value.trim()) && !!newPhoto.value && !addingUt.value,
)

async function onPhotoPicked(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    newPhoto.value = await compressPhoto(file)
  } catch {
    utError.value = 'No se pudo leer la foto. Tómala de nuevo.'
  }
}

async function addUtensil() {
  if (!canAddUt.value || !week.value) return
  addingUt.value = true
  utError.value = ''
  try {
    const u = await inventoryService.createUtensil({ company: company.value, name: newName.value.trim(), photo: newPhoto.value! })
    week.value.utensils.push(u)
    utCounts.value[u.id] = parseInt(newQty.value, 10)
    newName.value = ''
    newQty.value = ''
    newPhoto.value = null
    await saveNow('ut')
  } catch (e: any) {
    utError.value = e?.message || 'No se pudo agregar el utensilio.'
  } finally {
    addingUt.value = false
  }
}

const isNewUtensil = (id: string) => !history.value.some(h => id in h.utensils)

function open(s: 'ut' | 'products') {
  screen.value = s
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function backHome() {
  flushAll()
  screen.value = 'home'
}

onMounted(load)
onBeforeUnmount(flushAll)
</script>

<template>
  <div class="inv-page">
    <button v-if="screen !== 'home'" class="back" @click="backHome">← Toma de inventario</button>

    <header class="inv-head">
      <div class="ic">
        <i :class="screen === 'ut' ? 'fa-solid fa-utensils' : screen === 'products' ? 'fa-solid fa-boxes-stacked' : 'fa-solid fa-clipboard-check'"></i>
      </div>
      <div class="ht">
        <h1>{{ screen === 'ut' ? 'Utensilios' : screen === 'products' ? 'Productos' : 'Toma de inventario' }}</h1>
        <span v-if="weekLabel" class="today"><i class="fa-regular fa-calendar"></i> {{ weekLabel }}</span>
      </div>
      <span class="save" :class="saveState">
        <template v-if="saveState === 'saving'"><i class="fa-solid fa-spinner fa-spin"></i> Guardando…</template>
        <template v-else-if="saveState === 'saved'">✓ Guardado</template>
        <template v-else-if="saveState === 'error'">✕ Sin guardar</template>
      </span>
    </header>
    <p class="sub">
      <template v-if="screen === 'home'">Elige qué vas a contar. Puedes pasar de un bloque a otro cuando quieras. Un bloque cerrado se puede reabrir para corregir hasta las 23:59 del día de la toma.</template>
      <template v-else-if="screen === 'ut'">Cada toma agrega una columna nueva al lado de las anteriores. Todo utensilio nuevo se registra con su foto.</template>
      <template v-else>Elige el bloque: producto terminado, producto en proceso o materia prima. Puedes cambiar de bloque cuando quieras.</template>
    </p>
    <p v-if="saveState === 'error' && saveError" class="error">{{ saveError }}</p>

    <div v-if="loading" class="panel muted">Cargando…</div>
    <div v-else-if="loadError" class="panel">
      <p class="error">{{ loadError }}</p>
      <div><button class="btn" @click="load">Reintentar</button></div>
    </div>

    <template v-else-if="week && catalog">
      <div v-if="locked" class="lockmsg">
        <p>
          🔒 La toma del {{ shortDate(week.weekOf) }} está cerrada y ya no se puede modificar.
          <small>Pasó la medianoche del día de la toma. Para contar de nuevo, empieza una nueva toma.</small>
        </p>
        <button class="btn" :disabled="starting" @click="startNew">
          <i v-if="starting" class="fa-solid fa-spinner fa-spin"></i> ＋ Nueva toma de inventario
        </button>
      </div>
      <!-- Portada -->
      <template v-if="screen === 'home'">
        <section class="panel">
          <div class="who">
            <div class="field">
              <label for="inv-resp">Responsable de la toma</label>
              <select id="inv-resp" v-model="responsible">
                <option v-for="r in RESPONSIBLES" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
            <div class="field">
              <span class="lab">Empresa</span>
              <div class="seg">
                <button :class="{ sel: company === 'nicole' }" @click="company = 'nicole'">Nicole</button>
                <button :class="{ sel: company === 'sucree' }" @click="company = 'sucree'">Sucrée</button>
              </div>
            </div>
          </div>
        </section>
        <div class="choose">
          <button class="big" @click="open('ut')">
            <span class="bi"><i class="fa-solid fa-utensils"></i></span>
            <span class="bt">Utensilios</span>
            <span class="bs">Conteo con foto. Último conteo: {{ lastCountLabel }}</span>
            <span class="bitem"><span class="nm">{{ week.utensils.length }} utensilios</span><span class="pill" :class="pillOf('ut')">{{ PILL_TEXT[pillOf('ut')] }}</span></span>
          </button>
          <button class="big" @click="open('products')">
            <span class="bi"><i class="fa-solid fa-boxes-stacked"></i></span>
            <span class="bt">Productos</span>
            <span class="bs">Producto terminado, producto en proceso y materia prima</span>
            <span v-for="k in PRODUCT_BLOCKS" :key="k" class="bitem"><span class="nm">{{ blockTitle(k) }}</span><span class="pill" :class="pillOf(k)">{{ PILL_TEXT[pillOf(k)] }}</span></span>
          </button>
        </div>
      </template>

      <!-- Productos -->
      <template v-else-if="screen === 'products'">
        <div class="blocks">
          <button
            v-for="(k, i) in PRODUCT_BLOCKS"
            :key="k"
            class="blk"
            :class="{ sel: block === k, done: isClosed(k) }"
            @click="goBlock(k)"
          >
            <span class="n">{{ isClosed(k) ? '✓' : i + 1 }}</span>{{ blockTitle(k) }}
          </button>
        </div>
        <section class="panel">
          <h2>{{ blockTitle(block) }}</h2>
          <div v-if="isClosed(block) && !locked" class="donemsg">
            <p>✓ Bloque cerrado {{ closedInfo(block) }}<small>Puedes reabrirlo para corregir hasta las 23:59 de hoy.</small></p>
            <button class="btn warn" :disabled="reopening" @click="reopenBlock(block)">✎ Reabrir para corregir</button>
          </div>
          <div v-else-if="locked" class="donemsg muted">{{ isClosed(block) ? `✓ Bloque cerrado ${closedInfo(block)}.` : 'Este bloque no se cerró; quedó con lo que se guardó.' }}</div>
          <div v-if="!readOnly(block)" class="field">
            <span class="lab">Agregar ítem a {{ blockTitle(block).toLowerCase() }}</span>
            <div v-if="!categories.length" class="empty">Este bloque todavía no tiene productos. El Jefe de Operaciones los agrega en Inventarios › Ajustes.</div>
            <div v-else class="add">
              <div class="field">
                <label for="inv-cat">Categoría</label>
                <select id="inv-cat" v-model="category" @change="productCode = ''">
                  <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
              <div class="field">
                <label for="inv-prod">Producto</label>
                <select id="inv-prod" v-model="productCode">
                  <option value="">Elige…</option>
                  <option v-for="p in productsInCategory" :key="p.code" :value="p.code">{{ p.name }} · {{ p.code }}</option>
                </select>
              </div>
              <div class="field">
                <label for="inv-q">Cantidad</label>
                <input id="inv-q" v-model="quantity" inputmode="decimal" placeholder="0" @keydown.enter="addProduct" />
              </div>
              <div class="field">
                <label for="inv-u">Unidad</label>
                <select id="inv-u" v-model="unit">
                  <option v-for="u in catalog.units" :key="u" :value="u">{{ u }}</option>
                </select>
              </div>
              <button class="btn" :disabled="!canAdd" @click="addProduct">＋ Agregar</button>
            </div>
          </div>

          <div class="tbl-wrap">
            <table v-if="productItems[block].length">
              <thead><tr><th>Producto</th><th>Categoría</th><th class="r">Cantidad</th><th>Unidad</th><th v-if="!readOnly(block)"></th></tr></thead>
              <tbody>
                <tr v-for="(i, ix) in productItems[block]" :key="`${i.code}-${i.unit}`">
                  <td><span class="nm">{{ i.name }}</span><span class="cd">{{ i.code }}</span></td>
                  <td>{{ i.category }}</td>
                  <td class="r"><b>{{ String(i.quantity).replace('.', ',') }}</b></td>
                  <td>{{ i.unit }}</td>
                  <td v-if="!readOnly(block)" class="r"><button class="rm" :aria-label="`Quitar ${i.name}`" @click="removeProduct(ix)">✕</button></td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-st">Todavía no hay ítems. Elige categoría y producto, escribe la cantidad y toca “Agregar”.</div>
          </div>

          <div v-if="!readOnly(block)" class="foot">
            <span class="tot"><b>{{ productItems[block].length }}</b> ítems contados en {{ blockTitle(block).toLowerCase() }}</span>
            <button class="btn ok" :disabled="!productItems[block].length || closing" @click="closeBlock(block)">✓ Cerrar bloque</button>
          </div>
        </section>
      </template>

      <!-- Utensilios -->
      <section v-else class="panel">
        <div v-if="isClosed('ut') && !locked" class="donemsg">
          <p>✓ Conteo de utensilios cerrado {{ closedInfo('ut') }}<small>Puedes reabrirlo para corregir hasta las 23:59 de hoy.</small></p>
          <button class="btn warn" :disabled="reopening" @click="reopenBlock('ut')">✎ Reabrir para corregir</button>
        </div>
        <div v-else-if="locked" class="donemsg muted">{{ isClosed('ut') ? `✓ Conteo de utensilios cerrado ${closedInfo('ut')}.` : 'Este conteo no se cerró; quedó con lo que se guardó.' }}</div>
        <div v-else class="field">
          <span class="lab">Agregar utensilio nuevo · la foto es obligatoria</span>
          <div class="add ut">
            <div class="field">
              <label for="inv-ut-name">Nombre</label>
              <input id="inv-ut-name" v-model="newName" type="text" maxlength="80" placeholder="Ej.: Rodillo de madera 45 cm" />
            </div>
            <div class="field">
              <label for="inv-ut-q">Cantidad</label>
              <input id="inv-ut-q" v-model="newQty" inputmode="numeric" placeholder="0" />
            </div>
            <label class="photo" :class="{ has: !!newPhoto }" for="inv-ut-photo">
              <template v-if="newPhoto"><img :src="newPhoto" alt="" /> ✓ Foto lista</template>
              <template v-else><i class="fa-solid fa-camera"></i> Tomar foto</template>
              <input id="inv-ut-photo" type="file" accept="image/*" capture="environment" @change="onPhotoPicked" />
            </label>
            <button class="btn" :disabled="!canAddUt" @click="addUtensil">
              <i v-if="addingUt" class="fa-solid fa-spinner fa-spin"></i> ＋ Agregar
            </button>
          </div>
          <p v-if="!newPhoto && (newName || newQty)" class="note">Falta la foto para poder agregarlo.</p>
          <p v-if="utError" class="error">{{ utError }}</p>
        </div>

        <div class="tbl-wrap">
          <table v-if="week.utensils.length">
            <thead>
              <tr>
                <th>Foto</th><th>Utensilio</th>
                <th v-for="h in history" :key="h.weekOf" class="r">{{ shortDate(h.weekOf) }}</th>
                <th class="now">{{ week.editable ? 'Hoy' : 'Toma' }} · {{ shortDate(week.weekOf) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in week.utensils" :key="u.id">
                <td><img class="thumb" :src="u.photo" :alt="`Foto de ${u.name}`" /></td>
                <td><span class="nm">{{ u.name }}</span><span v-if="isNewUtensil(u.id)" class="nuevo">NUEVO</span></td>
                <td v-for="h in history" :key="h.weekOf" class="r old">{{ h.utensils[u.id] ?? '—' }}</td>
                <td class="now">
                  <span v-if="!readOnly('ut')" class="qty">
                    <button aria-label="Restar" @click="incUt(u.id, -1)">−</button>
                    <input
                      :id="`inv-ut-${u.id}`"
                      :class="{ empty: utCounts[u.id] == null }"
                      inputmode="numeric"
                      placeholder="?"
                      :value="utCounts[u.id] ?? ''"
                      :aria-label="`Conteo de hoy de ${u.name}`"
                      @change="setUt(u.id, $event)"
                    />
                    <button aria-label="Sumar" @click="incUt(u.id, 1)">+</button>
                  </span>
                  <b v-else>{{ utCounts[u.id] ?? '—' }}</b>
                  <span v-if="diffOf(u.id) != null" class="dif" :class="diffOf(u.id)! < 0 ? 'neg' : 'pos'">
                    {{ diffOf(u.id)! > 0 ? '+' : '' }}{{ diffOf(u.id) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-st">Todavía no hay utensilios. Agrega el primero con su foto.</div>
        </div>
        <p class="note">Las columnas grises son tomas anteriores y no se pueden cambiar. “—” = no se contó en esa toma. En rojo, lo que bajó frente a la toma anterior.</p>

        <div v-if="!readOnly('ut')" class="foot">
          <span class="tot"><b>{{ week.utensils.length - missingUt }}</b> de {{ week.utensils.length }} contados<template v-if="missingUt"> · faltan {{ missingUt }}</template></span>
          <button class="btn ok" :disabled="!week.utensils.length || missingUt > 0 || closing" @click="closeBlock('ut')">✓ Cerrar conteo</button>
        </div>
      </section>
    </template>
  </div>
</template>

<style lang="scss" scoped>
@use './inventory.scss';
</style>
