<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  inventoryService,
  type InventoryCompany,
  type InventoryMovement,
  type InventoryMovementPeriod,
  type InventoryMovementProduct,
} from '@/services/inventory.service'

/**
 * Movimiento de inventario (solo producto terminado). La ven Producción y el Jefe de Operaciones.
 * Cada toma de inventario cierra la semana anterior:
 *   debería haber = toma de inicio + producido (tablet) − despachado a islas − despachado en pedidos
 *   diferencia    = lo contado en la toma siguiente − debería haber
 * Se elige la semana (de una toma a la siguiente); la última sigue abierta hasta la próxima toma.
 * Solo lectura, salvo los comentarios por producto, que se guardan por periodo (toma que lo abre).
 */

const company = ref<InventoryCompany>('nicole')
const periods = ref<InventoryMovementPeriod[]>([])
const from = ref('')
const data = ref<InventoryMovement | null>(null)
const selected = ref('')
const loading = ref(true)
const loadError = ref('')
let seq = 0

// ── Comentarios por producto (cualquier producto; se guardan en el periodo) ──
const noteOf = (code: string) => data.value?.notes?.[code] || null
const editing = ref<{ code: string; name: string; text: string; had: boolean; saving: boolean; error: string } | null>(null)
const openNote = (r: { code: string; name: string }) => {
  const n = noteOf(r.code)
  editing.value = { code: r.code, name: r.name, text: n?.comment || '', had: !!n, saving: false, error: '' }
}
const noteTitle = (code: string) => {
  const n = noteOf(code)
  return n ? `${n.comment} (${n.updatedBy})` : 'Agregar comentario'
}
async function saveNote() {
  const e = editing.value
  if (!e || !data.value || (!e.text.trim() && !e.had)) return
  e.saving = true
  e.error = ''
  try {
    const saved = await inventoryService.saveMovementNote({
      company: data.value.company, from: data.value.from, code: e.code, name: e.name, comment: e.text.trim(),
    })
    const notes = { ...(data.value.notes || {}) }
    if (saved) notes[e.code] = saved
    else delete notes[e.code]
    data.value = { ...data.value, notes }
    editing.value = null
  } catch (err: any) {
    e.error = err?.response?.data?.message || 'No se pudo guardar.'
  } finally {
    e.saving = false
  }
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const wd = (d: string) => WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]
const dayLabel = (d: string) => `${wd(d)} ${dm(d)}`
const hm = (iso: string | null) => {
  if (!iso) return ''
  const t = new Date(new Date(iso).getTime() - 5 * 3600000)
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('es-EC', { maximumFractionDigits: 2 }))
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

function periodLabel(p: InventoryMovementPeriod) {
  if (p.open) return `Semana en curso · desde la toma del ${dayLabel(p.from)} (abierta)`
  return `Toma ${dayLabel(p.from)} → toma ${dayLabel(p.to!)}`
}

async function loadPeriods() {
  const mine = ++seq
  loading.value = true
  loadError.value = ''
  data.value = null
  try {
    const list = await inventoryService.getMovementPeriods(company.value)
    if (mine !== seq) return
    periods.value = list
    // Por defecto, la última semana ya contada (si existe); si no, la abierta.
    const def = list.find(p => !p.open) || list[0]
    from.value = def?.from || ''
    await loadMovement(mine)
  } catch (e: any) {
    if (mine === seq) loadError.value = e?.message || 'No se pudo cargar el movimiento. Revisa el internet.'
  } finally {
    if (mine === seq) loading.value = false
  }
}

async function loadMovement(mine = ++seq) {
  loading.value = true
  loadError.value = ''
  try {
    const d = await inventoryService.getMovement(company.value, from.value || undefined)
    if (mine !== seq) return
    data.value = d
    const all = (d.categories || []).flatMap(c => c.products)
    if (!all.some(p => p.code === selected.value)) selected.value = all[0]?.code || ''
  } catch (e: any) {
    if (mine === seq) loadError.value = e?.message || 'No se pudo cargar el movimiento. Revisa el internet.'
  } finally {
    if (mine === seq) loading.value = false
  }
}

watch(company, loadPeriods)
function onPeriod() {
  loadMovement()
}
onMounted(loadPeriods)

interface Row extends InventoryMovementProduct {
  prod: number
  islas: number
  cli: number
  deberia: number
  dif: number | null
}

function toRow(p: InventoryMovementProduct): Row {
  const prod = sum(p.produced)
  const islas = sum(p.toIslands)
  const cli = sum(p.toOrders)
  const deberia = Math.round((p.start + prod - islas - cli) * 1000) / 1000
  const dif = p.counted === null ? null : Math.round((p.counted - deberia) * 1000) / 1000
  return { ...p, prod, islas, cli, deberia, dif }
}

const groups = computed(() =>
  (data.value?.categories || []).map(c => ({ name: c.name, rows: c.products.map(toRow) })),
)
const allRows = computed(() => groups.value.flatMap(g => g.rows))
const totals = computed(() => {
  const r = allRows.value
  const faltan = r.filter(x => x.dif !== null && x.dif < 0)
  const sobran = r.filter(x => x.dif !== null && x.dif > 0)
  return {
    start: sum(r.map(x => x.start)),
    prod: sum(r.map(x => x.prod)),
    islas: sum(r.map(x => x.islas)),
    cli: sum(r.map(x => x.cli)),
    deberia: sum(r.map(x => x.deberia)),
    counted: data.value?.open ? null : sum(r.map(x => x.counted || 0)),
    faltan: -sum(faltan.map(x => x.dif!)),
    sobran: sum(sobran.map(x => x.dif!)),
  }
})

const isOpen = computed(() => !!data.value?.open)
const colStart = computed(() => (data.value ? `Toma ${dm(data.value.from)}` : 'Toma'))
const colCount = computed(() => (data.value?.to ? `Contado ${dm(data.value.to)}` : 'Contado'))

function difText(d: number | null) {
  if (d === null) return '—'
  if (d < 0) return `−${fmt(-d)} faltan`
  if (d > 0) return `+${fmt(d)} sobran`
  return '0 cuadra'
}
const difClass = (d: number | null) => (d === null ? 'na' : d < 0 ? 'bad' : d > 0 ? 'over' : 'ok')

const detail = computed(() => {
  const d = data.value
  const r = allRows.value.find(x => x.code === selected.value)
  if (!d || !r) return null
  let saldo = r.start
  const lines = d.days.map((day, i) => {
    const pr = r.produced[i] || 0
    const is = r.toIslands[i] || 0
    const cl = r.toOrders[i] || 0
    saldo = Math.round((saldo + pr - is - cl) * 1000) / 1000
    const label = dayLabel(day) + (d.open && day === d.today ? ' (hasta ahora)' : '')
    return { day, label, pr, is, cl, saldo }
  })
  return { row: r, lines }
})

const startNote = computed(() => {
  const d = data.value
  if (!d) return ''
  const who = d.responsibleFrom ? ` · ${d.responsibleFrom}` : ''
  return d.startClosed ? `Toma del ${dayLabel(d.from)}, cerrada a las ${hm(d.startAt)}${who}` : `Toma del ${dayLabel(d.from)}${who} (el bloque Producto terminado no se cerró: cuenta desde que se empezó la toma)`
})
</script>

<template>
  <div class="inv-page">
    <header class="inv-head">
      <div class="ic"><i class="fa-solid fa-arrow-right-arrow-left"></i></div>
      <div class="ht">
        <h1>Movimiento de inventario</h1>
        <span v-if="data && !data.empty" class="today">
          <i class="fa-regular fa-calendar"></i>
          <template v-if="data.open">Semana abierta · se cierra con la próxima toma</template>
          <template v-else>Toma {{ dayLabel(data.from) }} → toma {{ dayLabel(data.to!) }}</template>
        </span>
      </div>
    </header>
    <p class="sub">
      Solo producto terminado. Cada toma de inventario cierra la semana: parte de la toma anterior, suma lo que
      los operarios ingresan en la tablet, resta lo despachado a islas y en pedidos, y lo compara con lo contado.
      Elige una semana para ver su diferencia.
    </p>

    <section class="panel filters">
      <div class="field">
        <span class="lab">Empresa</span>
        <div class="seg">
          <button :class="{ sel: company === 'nicole' }" @click="company = 'nicole'">Nicole</button>
          <button :class="{ sel: company === 'sucree' }" @click="company = 'sucree'">Sucrée</button>
        </div>
      </div>
      <div class="field period">
        <label for="mov-period">Semana</label>
        <select id="mov-period" v-model="from" :disabled="!periods.length" @change="onPeriod">
          <option v-for="p in periods" :key="p.from" :value="p.from">{{ periodLabel(p) }}</option>
        </select>
      </div>
    </section>

    <div v-if="loading" class="panel muted">Cargando…</div>
    <div v-else-if="loadError" class="panel">
      <p class="error">{{ loadError }}</p>
      <div><button class="btn" @click="loadPeriods">Reintentar</button></div>
    </div>
    <div v-else-if="!data || data.empty" class="panel muted">
      Todavía no hay tomas de inventario de esta empresa. La primera toma es el punto de partida.
    </div>

    <template v-else>
      <p class="note">{{ startNote }}</p>

      <div v-if="!allRows.length" class="panel muted">No hay producto terminado contado, producido ni despachado en esta semana.</div>

      <div v-else class="tbl-wrap mv">
        <table>
          <thead>
            <tr>
              <th class="l">Producto</th>
              <th>{{ colStart }}</th>
              <th class="in">+ Producido</th>
              <th class="out">− A islas</th>
              <th class="out">− Pedidos</th>
              <th class="should">= Debería haber</th>
              <th>{{ colCount }}</th>
              <th>Diferencia</th>
            </tr>
          </thead>
          <tbody v-for="g in groups" :key="g.name">
            <tr class="cat">
              <td colspan="8">{{ g.name }} <span>· {{ g.rows.length }} productos</span></td>
            </tr>
            <tr v-for="r in g.rows" :key="r.code" :class="{ sel: r.code === selected }">
              <td class="l">
                <button class="pname" :aria-pressed="r.code === selected" @click="selected = r.code">
                  <span class="nm">{{ r.name }}</span>
                  <small>{{ r.code }}<template v-if="!r.inCatalog"> · fuera del catálogo</template></small>
                </button>
              </td>
              <td>{{ fmt(r.start) }}</td>
              <td class="in">{{ r.prod ? '+' + fmt(r.prod) : '0' }}</td>
              <td class="out">{{ r.islas ? '−' + fmt(r.islas) : '0' }}</td>
              <td class="out">{{ r.cli ? '−' + fmt(r.cli) : '0' }}</td>
              <td class="should" :class="{ neg: r.deberia < 0 }">{{ fmt(r.deberia) }}</td>
              <td class="b">{{ r.counted === null ? '—' : fmt(r.counted) }}</td>
              <td class="dif" :class="difClass(r.dif)">
                {{ difText(r.dif) }}
                <button
                  type="button"
                  class="note-btn"
                  :class="{ filled: !!noteOf(r.code) }"
                  :title="noteTitle(r.code)"
                  :aria-label="noteOf(r.code) ? `Comentario de ${r.name}: ${noteTitle(r.code)}` : `Comentar ${r.name}`"
                  @click="openNote(r)"
                >
                  <i :class="noteOf(r.code) ? 'fa-solid fa-comment-dots' : 'fa-regular fa-comment'"></i>
                </button>
                <div v-if="editing && editing.code === r.code" class="note-pop" @keydown.esc="editing = null">
                  <textarea v-model="editing.text" maxlength="500" rows="3" placeholder="Escribe un comentario sobre este producto en la semana" :aria-label="`Comentario de ${r.name}`"></textarea>
                  <p v-if="editing.error" class="note-err">{{ editing.error }}</p>
                  <div class="note-actions">
                    <span>{{ editing.text.length }}/500</span>
                    <button type="button" class="ghost" @click="editing = null">Cancelar</button>
                    <button type="button" class="primary" :disabled="editing.saving || (!editing.text.trim() && !editing.had)" @click="saveNote">
                      {{ editing.saving ? 'Guardando…' : (!editing.text.trim() && editing.had ? 'Borrar' : 'Guardar') }}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="l">Total</td>
              <td>{{ fmt(totals.start) }}</td>
              <td class="in">+{{ fmt(totals.prod) }}</td>
              <td class="out">−{{ fmt(totals.islas) }}</td>
              <td class="out">−{{ fmt(totals.cli) }}</td>
              <td class="should">{{ fmt(totals.deberia) }}</td>
              <td>{{ totals.counted === null ? '—' : fmt(totals.counted) }}</td>
              <td class="tot-dif">{{ isOpen ? '—' : `−${fmt(totals.faltan)} / +${fmt(totals.sobran)}` }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p v-if="data.unmatched.lines" class="note">
        {{ data.unmatched.lines }} líneas despachadas ({{ fmt(data.unmatched.units) }} u.) no están en el catálogo de
        producto terminado y no se restan<template v-if="data.unmatched.names.length">: {{ data.unmatched.names.join(', ') }}</template>.
      </p>

      <section v-if="detail" class="panel detail">
        <div class="dh">
          <h2>{{ detail.row.name }}</h2>
          <span class="muted">{{ detail.row.code }} · día a día</span>
        </div>
        <div class="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th class="l">Día</th>
                <th class="in">+ Producido</th>
                <th class="out">− A islas</th>
                <th class="out">− Pedidos</th>
                <th>Queda</th>
              </tr>
            </thead>
            <tbody>
              <tr class="strong">
                <td class="l">Toma {{ dayLabel(data.from) }}<template v-if="data.startClosed"> · {{ hm(data.startAt) }}</template></td>
                <td></td><td></td><td></td>
                <td>{{ fmt(detail.row.start) }}</td>
              </tr>
              <tr v-for="l in detail.lines" :key="l.day">
                <td class="l">{{ l.label }}</td>
                <td class="in">{{ l.pr ? '+' + fmt(l.pr) : '—' }}</td>
                <td class="out">{{ l.is ? '−' + fmt(l.is) : '—' }}</td>
                <td class="out">{{ l.cl ? '−' + fmt(l.cl) : '—' }}</td>
                <td class="b" :class="{ neg: l.saldo < 0 }">{{ fmt(l.saldo) }}</td>
              </tr>
              <tr v-if="!data.open" class="strong">
                <td class="l">Contado {{ dayLabel(data.to!) }} · <span :class="['dif', difClass(detail.row.dif)]">{{ difText(detail.row.dif) }}</span></td>
                <td></td><td></td><td></td>
                <td>{{ fmt(detail.row.counted || 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="how">
        <h2>Cómo se calcula</h2>
        <ul>
          <li><strong>Punto de partida:</strong> la toma que abre la semana (bloque Producto terminado). Desde la hora en que se cierra ese bloque empieza a contar todo lo demás.</li>
          <li><strong>Entra:</strong> lo que cada operario registra en Ingreso de producción, por código de producto.</li>
          <li><strong>Sale:</strong> lo que Producción reporta como despachado, cuando sale de planta, sin esperar a que el punto de venta lo reciba: reposición a islas y pedidos de clientes.</li>
          <li><strong>Diferencia:</strong> lo contado en la toma siguiente menos lo que debería haber. Si falta, es merma o algo no registrado. Si sobra, casi siempre es producción que no se ingresó en la tablet.</li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style lang="scss" scoped>
@use './inventory.scss';

$violet: #7c3aed;
$line: #e8ecf2;
$soft: #f8fafc;
$muted: #64748b;
$fg: #1e293b;

.filters { flex-direction: row; flex-wrap: wrap; align-items: flex-end; gap: 22px; }
.period { flex: 1 1 320px; max-width: 460px; }
.note { max-width: 1100px; }

.mv, .detail .tbl-wrap { max-width: 1100px; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th { background: $soft; font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: $muted; padding: 12px 10px; text-align: right; border-bottom: 1px solid $line; white-space: nowrap; }
td { padding: 6px 10px; text-align: right; border-bottom: 1px solid #f1f5f9; font-size: .95rem; }
.l { text-align: left; }
th.in, td.in { color: #166534; }
th.out, td.out { color: #9a3412; }
th.should { color: #6d28d9; }
td.should { font-weight: 800; color: #4c1d95; }
.neg { color: #b91c1c !important; }
.b { font-weight: 700; }
tr.cat td { text-align: left; font-size: .82rem; font-weight: 800; color: #334155; background: #fff; padding: 10px 14px;
  span { font-weight: 600; color: $muted; }
}
tbody tr.sel { background: #f5f3ff; box-shadow: inset 3px 0 0 $violet; }
.pname { font: inherit; text-align: left; border: none; background: transparent; padding: 6px; border-radius: 8px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; min-height: 44px; justify-content: center; width: 100%;
  &:hover { background: #fbf9ff; }
  .nm { font-weight: 700; color: $fg; }
  small { font-size: .75rem; color: $muted; }
}
.dif { font-weight: 800; white-space: nowrap;
  &.bad { color: #b91c1c; }
  &.over { color: #1d4ed8; }
  &.ok { color: #15803d; }
  &.na { color: #94a3b8; }
}
tfoot td { background: $soft; font-weight: 800; border-top: 1px solid $line; padding: 14px 10px; }
.tot-dif { font-size: .85rem; color: #475569; }

.detail { max-width: 1100px;
  .dh { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
    h2 { font-size: 1.15rem; }
    .muted { font-size: .85rem; }
  }
  td { padding: 10px; }
  tr.strong td { background: $soft; font-weight: 700; }
}

.how { border-top: 1px solid $line; padding-top: 16px; max-width: 900px;
  h2 { margin: 0 0 8px; font-size: 1rem; }
  ul { margin: 0; padding-left: 20px; color: #475569; font-size: .9rem; line-height: 1.6; }
}
.note-btn {
  margin-left: 0.35rem; border: none; background: transparent; cursor: pointer;
  color: #cbd5e1; opacity: 0.7; font-size: 0.85rem; padding: 2px 5px; border-radius: 6px; vertical-align: middle;
  &:hover, &:focus-visible { opacity: 1; color: #94a3b8; }
  &.filled { color: #d97706; background: #fef3c7; opacity: 1; }
}
.note-pop {
  // dentro de la celda: la tabla tiene scroll y un recuadro flotante se cortaría
  margin: 0.4rem 0 0 auto; width: 260px; white-space: normal;
  background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.6rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.15); text-align: left; font-size: 0.82rem; font-weight: 400; color: #1e293b;
  textarea { width: 100%; box-sizing: border-box; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 0.45rem; font: inherit; resize: vertical; color: #1e293b; }
  textarea:focus { outline: none; border-color: #7c3aed; }
  .note-err { margin: 0.3rem 0 0; color: #dc2626; font-size: 0.75rem; }
  .note-actions { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.45rem;
    span { margin-right: auto; color: #94a3b8; font-size: 0.7rem; }
    button { border-radius: 8px; padding: 0.35rem 0.75rem; font-weight: 700; font-size: 0.78rem; cursor: pointer; border: 1px solid #e2e8f0; }
    .ghost { background: white; color: #475569; }
    .primary { background: #7c3aed; border-color: #7c3aed; color: white; }
    .primary:disabled { background: #cbd5e1; border-color: #cbd5e1; cursor: not-allowed; }
  }
}
</style>
