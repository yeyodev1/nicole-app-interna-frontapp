<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  productionEntryService,
  type ProductionDay,
  type ProductionDayEntry,
  type ProductionCatalogItem,
  type ProductionCompany,
} from '@/services/production-entry.service'

/**
 * Fichas guardadas, debajo del registro en la tablet. Por defecto las de hoy; se puede elegir otra fecha.
 * Las de hoy las puede corregir cualquiera hasta las 00:00 (Ecuador). Las anteriores solo se ven.
 */
const props = defineProps<{
  today: string // AAAA-MM-DD (del servidor)
  catalog: Record<ProductionCompany, ProductionCatalogItem[]>
}>()

type Item = ProductionDayEntry['items'][number]

const day = ref<ProductionDay | null>(null)
const date = ref(props.today)
const loading = ref(false)
const loadError = ref('')
const editingId = ref<string | null>(null)
const draft = ref<Item[]>([])
const addCode = ref('')
const saving = ref(false)
const editError = ref('')
const notice = ref('')

const isToday = computed(() => date.value === (day.value?.today || props.today))
const editable = computed(() => !!day.value?.editable)
const entries = computed(() => day.value?.entries || [])
const dayUnits = computed(() =>
  entries.value.reduce((s, e) => s + (e.id === editingId.value ? draftTotal.value : e.totalUnits), 0),
)
const draftTotal = computed(() => draft.value.reduce((s, i) => s + i.quantity, 0))
const editingEntry = computed(() => entries.value.find(e => e.id === editingId.value) || null)
const addOptions = computed(() => {
  const company = editingEntry.value?.company
  if (!company) return []
  const groups = new Map<string, ProductionCatalogItem[]>()
  for (const p of props.catalog[company] || []) {
    if (!groups.has(p.category)) groups.set(p.category, [])
    groups.get(p.category)!.push(p)
  }
  return Array.from(groups, ([category, products]) => ({ category, products }))
})

const title = computed(() => {
  if (isToday.value) return 'Fichas de hoy'
  const d = new Date(`${date.value}T12:00:00`)
  return `Fichas del ${d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}`
})

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function shift(d: string, n: number) {
  const x = new Date(`${d}T12:00:00Z`)
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    day.value = await productionEntryService.getDay(date.value)
  } catch (e: any) {
    loadError.value = e?.message || 'No se pudieron cargar las fichas. Revisa el internet de la tablet.'
  } finally {
    loading.value = false
  }
}

function goTo(d: string) {
  const max = day.value?.today || props.today
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > max) return
  cancelEdit()
  notice.value = ''
  date.value = d
  load()
}
function onDateInput(ev: Event) {
  goTo((ev.target as HTMLInputElement).value)
}

// ───────────── Corrección ─────────────
function startEdit(e: ProductionDayEntry) {
  editingId.value = e.id
  draft.value = e.items.map(i => ({ ...i }))
  addCode.value = ''
  editError.value = ''
  notice.value = ''
}
function cancelEdit() {
  editingId.value = null
  draft.value = []
  editError.value = ''
}
function inc(i: number) {
  const it = draft.value[i]
  if (it) it.quantity = Math.min(2000, it.quantity + 1)
}
function dec(i: number) {
  const it = draft.value[i]
  if (it) it.quantity = Math.max(1, it.quantity - 1)
}
function setQty(i: number, ev: Event) {
  const it = draft.value[i]
  if (!it) return
  const n = parseInt((ev.target as HTMLInputElement).value, 10)
  it.quantity = Number.isFinite(n) && n > 0 ? Math.min(n, 2000) : 1
}
function removeItem(i: number) { draft.value.splice(i, 1) }
function addProduct() {
  const company = editingEntry.value?.company
  const p = company ? props.catalog[company]?.find(x => x.code === addCode.value) : null
  if (!p) return
  const existing = draft.value.find(i => i.code === p.code)
  if (existing) existing.quantity = Math.min(2000, existing.quantity + 1)
  else draft.value.push({ ...p, quantity: 1 })
  addCode.value = ''
}

async function save() {
  if (!editingId.value || saving.value) return
  if (!draft.value.length) {
    editError.value = 'La ficha no puede quedar vacía: deja al menos un producto.'
    return
  }
  saving.value = true
  editError.value = ''
  try {
    await productionEntryService.updateEntry(
      editingId.value,
      draft.value.map(i => ({ code: i.code, quantity: i.quantity })),
    )
    cancelEdit()
    notice.value = 'Cambios guardados. La ficha queda marcada como corregida.'
    await load()
  } catch (e: any) {
    editError.value = e?.message || 'No se pudo guardar. Revisa el internet y vuelve a tocar "Guardar cambios".'
    // Si pasó la medianoche, la ficha ya está cerrada: se recarga para mostrarla así.
    if (e?.status === 400 && /cerrada/i.test(e?.message || '')) {
      cancelEdit()
      notice.value = e.message
      await load()
    }
  } finally {
    saving.value = false
  }
}

/** Lo llama la pantalla de registro después de enviar una ficha nueva. */
function showToday() {
  cancelEdit()
  notice.value = ''
  date.value = props.today
  load()
}
defineExpose({ showToday })

onMounted(load)
</script>

<template>
  <section class="de" aria-labelledby="de-title">
    <div class="de-head">
      <h2 id="de-title">{{ title }}</h2>
      <div class="datebar">
        <button class="arrow" aria-label="Día anterior" @click="goTo(shift(date, -1))">‹</button>
        <label class="sr" for="de-date">Fecha</label>
        <input id="de-date" type="date" :value="date" :max="day?.today || today" @change="onDateInput" />
        <button class="arrow" aria-label="Día siguiente" :disabled="isToday" @click="goTo(shift(date, 1))">›</button>
        <button v-if="!isToday" class="hoy" @click="goTo(day?.today || today)">Hoy</button>
      </div>
    </div>

    <div v-if="loading && !day" class="muted">Cargando…</div>
    <div v-else-if="loadError" class="note err">
      {{ loadError }} <button class="link" @click="load">Reintentar</button>
    </div>

    <template v-else-if="day">
      <div class="meta"><b>{{ plural(entries.length, 'ficha', 'fichas') }}</b> · <b>{{ dayUnits }}</b> unidades</div>

      <div v-if="editable" class="note ok">Las fichas de hoy se pueden corregir hasta las 00:00. Después quedan cerradas.</div>
      <div v-else class="note lock"><i class="fa-solid fa-lock"></i> Día cerrado: estas fichas solo se pueden ver. Si hay un error, avisa al Jefe de Operaciones.</div>

      <div v-if="notice" class="note info" role="status">{{ notice }}</div>

      <div v-if="!entries.length" class="empty">No hay fichas guardadas este día.</div>

      <article v-for="e in entries" :key="e.id" class="card" :class="{ ed: e.id === editingId }">
        <div class="ch">
          <span class="av">{{ e.operatorName.charAt(0).toUpperCase() }}</span>
          <div class="who">
            <b>{{ e.operatorName }}</b>
            <span>{{ e.company === 'nicole' ? 'Nicole' : 'Sucrée' }} · {{ e.area }} · {{ plural(e.id === editingId ? draft.length : e.items.length, 'producto', 'productos') }}</span>
            <span class="t">Enviada {{ timeOf(e.createdAt) }}<template v-if="e.editedAt"> · <span class="cor">corregida {{ timeOf(e.editedAt) }}</span></template></span>
          </div>
          <div class="tot">{{ e.id === editingId ? draftTotal : e.totalUnits }} u</div>
          <button v-if="editable && !editingId" class="btn-e" @click="startEdit(e)"><i class="fa-solid fa-pen"></i> Corregir</button>
          <span v-else-if="!editable" class="closed"><i class="fa-solid fa-lock"></i> Cerrada</span>
        </div>

        <template v-if="e.id !== editingId">
          <div v-for="i in e.items" :key="i.code" class="row">
            <div>{{ i.name }} <span class="cat">· {{ i.code }} · {{ i.category }}</span></div>
            <b>{{ i.quantity }}</b>
          </div>
        </template>

        <div v-else class="edit">
          <span class="lab">Corrigiendo esta ficha</span>
          <div v-for="(i, ix) in draft" :key="i.code" class="erow">
            <div class="nm">{{ i.name }}<span class="cat">{{ i.code }} · {{ i.category }}</span></div>
            <div class="qty">
              <button aria-label="Restar" @click="dec(ix)">−</button>
              <input inputmode="numeric" :value="i.quantity" :aria-label="`Cantidad de ${i.name}`" @change="setQty(ix, $event)" />
              <button aria-label="Sumar" @click="inc(ix)">+</button>
            </div>
            <button class="rm" :aria-label="`Quitar ${i.name}`" @click="removeItem(ix)">✕</button>
          </div>

          <div class="add">
            <label for="de-add">Agregar otro producto</label>
            <div class="add-row">
              <select id="de-add" v-model="addCode">
                <option value="">Elige un producto…</option>
                <optgroup v-for="g in addOptions" :key="g.category" :label="g.category">
                  <option v-for="p in g.products" :key="p.code" :value="p.code">{{ p.name }} · {{ p.code }}</option>
                </optgroup>
              </select>
              <button class="btn-g" :disabled="!addCode" @click="addProduct">＋ Agregar</button>
            </div>
          </div>

          <p v-if="editError" class="note err">{{ editError }}</p>
          <div class="foot">
            <span>Total <b>{{ draftTotal }}</b> unidades</span>
            <div class="acts">
              <button class="btn-g" :disabled="saving" @click="cancelEdit">Cancelar</button>
              <button class="btn-p" :disabled="saving || !draft.length" @click="save">
                <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
                {{ saving ? 'Guardando…' : '✓ Guardar cambios' }}
              </button>
            </div>
          </div>
        </div>
      </article>
    </template>
  </section>
</template>

<style lang="scss" scoped>
$violet: #7c3aed;
$violet-soft: #f3e8ff;
$line: #e8ecf2;
$soft: #f8fafc;
$muted: #64748b;

.de { border: 1px solid $line; border-radius: 16px; padding: 20px 24px; max-width: 900px; display: flex; flex-direction: column; gap: 12px; background: #fff; }
.de-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  h2 { margin: 0; font-size: 1.15rem; font-weight: 800; text-transform: none; }
}
.datebar { display: flex; align-items: center; gap: 6px;
  input { font: inherit; height: 44px; border: 1px solid $line; border-radius: 12px; padding: 0 10px; color: #1e293b; background: #fff; }
}
.arrow { width: 44px; height: 44px; border: 1px solid $line; border-radius: 12px; background: #fff; font-size: 1.3rem; font-weight: 700; color: #4c1d95; cursor: pointer;
  &:disabled { opacity: .35; cursor: not-allowed; }
}
.hoy { height: 44px; border: 1px solid #ddd6fe; border-radius: 12px; background: $violet-soft; color: $violet; font: inherit; font-weight: 700; padding: 0 14px; cursor: pointer; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.muted { color: $muted; }
.meta { font-size: .92rem; color: #334155; }
.note { border-radius: 10px; padding: 10px 14px; font-size: .88rem; margin: 0;
  &.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
  &.lock { background: $soft; border: 1px solid $line; color: #475569; }
  &.info { background: #f5f3ff; border: 1px solid #ddd6fe; color: #5b21b6; font-weight: 600; }
  &.err { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
}
.link { font: inherit; font-weight: 700; color: $violet; background: none; border: none; cursor: pointer; text-decoration: underline; }
.empty { text-align: center; color: $muted; padding: 22px; border: 1px dashed #cbd5e1; border-radius: 12px; font-size: .9rem; }
.card { border: 1px solid $line; border-radius: 14px; overflow: hidden; background: #fff;
  &.ed { border: 2px solid #a78bfa; }
}
.ch { display: flex; align-items: center; gap: 12px; padding: 12px 14px; flex-wrap: wrap; }
.av { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; color: #fff; background: linear-gradient(160deg, #c9a9c1, #7b2d6b); flex-shrink: 0; }
.who { flex: 1 1 200px; min-width: 0;
  b { display: block; color: #1e293b; }
  span { display: block; font-size: .82rem; color: $muted; }
  .t { margin-top: 2px; font-weight: 700; color: #6d28d9; }
  .cor { display: inline; color: #b45309; }
}
.tot { font-weight: 800; color: #3b1d6e; font-size: 1.1rem; font-variant-numeric: tabular-nums; }
.btn-e { min-height: 44px; border: 1px solid #ddd6fe; border-radius: 12px; background: $violet-soft; color: $violet; font: inherit; font-weight: 700; padding: 0 16px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.closed { font-size: .85rem; color: $muted; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
.row { display: flex; justify-content: space-between; gap: 10px; padding: 9px 14px; border-top: 1px solid $line; font-size: .92rem; color: #334155;
  b { font-variant-numeric: tabular-nums; }
}
.cat { color: $muted; font-size: .75rem; }
.edit { border-top: 1px solid #ddd6fe; background: #faf8ff; padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 8px; }
.lab, .add > label { font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: #5b21b6; }
.add > label { color: $muted; }
.erow { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #ede9fe; flex-wrap: wrap;
  .nm { flex: 1 1 180px; min-width: 0; font-weight: 600; }
  .cat { display: block; }
}
.qty { display: flex; align-items: center; gap: 6px;
  button { width: 44px; height: 44px; border-radius: 12px; border: 1px solid $line; background: #fff; font-size: 1.3rem; font-weight: 700; cursor: pointer; color: #1e293b; }
  input { width: 64px; height: 44px; text-align: center; font: inherit; font-size: 1.1rem; font-weight: 800; border: 1px solid $line; border-radius: 12px; font-variant-numeric: tabular-nums; }
}
.rm { width: 44px; height: 44px; border-radius: 12px; border: 1px solid #fecaca; background: #fff5f5; color: #b91c1c; font-size: 1.1rem; cursor: pointer; }
.add { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; }
.add-row { display: flex; gap: 8px; flex-wrap: wrap;
  select { flex: 1 1 240px; font: inherit; height: 48px; border: 1px solid $line; border-radius: 12px; padding: 0 12px; background: #fff; color: #1e293b; min-width: 0; }
}
.btn-g { min-height: 48px; border: 1px solid $line; border-radius: 12px; background: #fff; color: #334155; font: inherit; font-weight: 700; padding: 0 16px; cursor: pointer;
  &:disabled { opacity: .45; cursor: not-allowed; }
}
.btn-p { min-height: 48px; border: none; border-radius: 12px; background: $violet; color: #fff; font: inherit; font-weight: 800; padding: 0 18px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
  &:disabled { opacity: .45; cursor: not-allowed; }
}
.foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 8px;
  b { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
  .acts { display: flex; gap: 8px; }
}

@media (max-width: 760px) {
  .de { padding: 16px; }
}
</style>
