<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  productionHistoryService,
  type ProductionHistory,
  type HistoryEntry,
  type HistoryOperator,
  money,
  longDate,
  timeOf,
} from '@/services/production-history.service'

/**
 * Hoy en planta: producción general de la planta en un rango de fechas (Desde / Hasta).
 * Hoy–hoy = solo el día de hoy. Sale de los mismos ingresos de la tablet que el Histórico:
 * pide al servidor cada mes del rango (el endpoint es por mes) y los junta aquí.
 */
const props = defineProps<{
  /** Mes actual ya cargado por la pantalla (se reutiliza para no pedirlo dos veces). Trae "hoy" del servidor. */
  seed: ProductionHistory
}>()

const emit = defineEmits<{ (e: 'open-operator', id: string, month: string): void }>()

const MAX_DAYS = 92 // ~3 meses
const REFRESH_MS = 5 * 60 * 1000

const today = ref(props.seed.today)
const from = ref(today.value)
const to = ref(today.value)
const rangeError = ref('')
const loading = ref(false)
const error = ref('')
const months = ref<Record<string, ProductionHistory>>({})
let reqId = 0
let timer: ReturnType<typeof setInterval> | null = null

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const daysOf = (a: string, b: string) => {
  const out: string[] = []
  for (let x = a; x <= b && out.length <= MAX_DAYS; x = addDays(x, 1)) out.push(x)
  return out
}
const monthsOf = (a: string, b: string) => Array.from(new Set(daysOf(a, b).map(d => d.slice(0, 7))))

months.value[props.seed.month] = props.seed

async function loadRange(force = false) {
  const id = ++reqId
  const needed = monthsOf(from.value, to.value)
  const currentMonth = today.value.slice(0, 7)
  const missing = needed.filter(m => force ? (m === currentMonth || !months.value[m]) : !months.value[m])
  if (!missing.length) return
  loading.value = true
  error.value = ''
  try {
    const got = await Promise.all(missing.map(m => productionHistoryService.getHistory(m)))
    if (id !== reqId) return
    for (const h of got) {
      months.value[h.month] = h
      if (h.today) today.value = h.today
    }
  } catch (e: any) {
    if (id === reqId) error.value = e?.message || 'No se pudo cargar la producción.'
  } finally {
    if (id === reqId) loading.value = false
  }
}

function applyRange(a: string, b: string) {
  if (!a || !b) return
  if (a > b) { rangeError.value = '"Desde" no puede ser después de "Hasta".'; return }
  if (b > today.value) { rangeError.value = '"Hasta" no puede ser un día futuro.'; return }
  if (daysOf(a, b).length > MAX_DAYS) { rangeError.value = 'El rango máximo es de 3 meses.'; return }
  rangeError.value = ''
  from.value = a
  to.value = b
  loadRange()
}

const fromInput = ref(from.value)
const toInput = ref(to.value)
watch([fromInput, toInput], ([a, b]) => applyRange(a, b))


// ── Datos del rango ──
const single = computed(() => from.value === to.value)
const isToday = computed(() => single.value && from.value === today.value)
const includesToday = computed(() => to.value === today.value)
const rangeDays = computed(() => (from.value && to.value ? daysOf(from.value, to.value) : []))
const ready = computed(() => rangeDays.value.length > 0 && monthsOf(from.value, to.value).every(m => months.value[m]))

const entries = computed<HistoryEntry[]>(() => {
  if (!ready.value) return []
  const out: HistoryEntry[] = []
  for (const m of monthsOf(from.value, to.value)) {
    for (const e of months.value[m]?.entries || []) if (e.date >= from.value && e.date <= to.value) out.push(e)
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
})

const pricesOk = computed(() => monthsOf(from.value, to.value).every(m => months.value[m]?.pricesAvailable !== false))

// Operarios: los del mes más reciente del rango (con foto y estado) + cualquiera que aparezca en los ingresos.
const operators = computed<HistoryOperator[]>(() => {
  const map = new Map<string, HistoryOperator>()
  for (const m of monthsOf(from.value, to.value).reverse()) {
    for (const o of months.value[m]?.operators || []) if (!map.has(o.id)) map.set(o.id, o)
  }
  return Array.from(map.values())
})
const activeOperators = computed(() => operators.value.filter(o => o.active))

const units = computed(() => entries.value.reduce((s, e) => s + e.totalUnits, 0))
const value = computed(() => entries.value.reduce((s, e) => s + e.value, 0))
const unitsOf = (company: 'nicole' | 'sucree') => entries.value.filter(e => e.company === company).reduce((s, e) => s + e.totalUnits, 0)
const nicoleUnits = computed(() => unitsOf('nicole'))
const sucreeUnits = computed(() => unitsOf('sucree'))
const prodDays = computed(() => new Set(entries.value.map(e => e.date)).size)
const productCount = computed(() => new Set(entries.value.flatMap(e => e.items.map(i => i.code || i.name))).size)
const whoIds = computed(() => new Set(entries.value.map(e => e.operatorId)))
const missingCount = computed(() => activeOperators.value.filter(o => !whoIds.value.has(o.id)).length)
const lastEntry = computed(() => entries.value[entries.value.length - 1] || null)

const title = computed(() => {
  if (!from.value) return 'Producción'
  if (isToday.value) return `Producción de hoy · ${longDate(from.value)}`
  if (single.value) return `Producción del ${longDate(from.value)}`
  const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })
  return `Producción del ${short(from.value)} al ${short(to.value)} · ${rangeDays.value.length} días`
})

// Productos sumados, agrupados por área
const areas = computed(() => {
  const byArea = new Map<string, Map<string, { key: string; name: string; code: string; company: string; units: number; value: number; ops: Set<string> }>>()
  for (const e of entries.value) {
    const area = e.area || 'Sin área'
    if (!byArea.has(area)) byArea.set(area, new Map())
    const prods = byArea.get(area)!
    for (const i of e.items) {
      const key = `${e.company}|${i.code || i.name}`
      const p = prods.get(key) || { key, name: i.name, code: i.code, company: e.company, units: 0, value: 0, ops: new Set<string>() }
      p.units += i.quantity
      p.value += i.quantity * i.unitPrice
      p.ops.add(e.operatorName)
      prods.set(key, p)
    }
  }
  return Array.from(byArea.entries())
    .map(([area, prods]) => {
      const list = Array.from(prods.values()).sort((a, b) => b.units - a.units)
      return { area, list, units: list.reduce((s, p) => s + p.units, 0) }
    })
    .sort((a, b) => b.units - a.units)
})

// Por operario
const perOperator = computed(() => {
  const rows = new Map<string, { id: string; name: string; photo: string | null; units: number; value: number; days: Set<string>; areas: Set<string>; active: boolean }>()
  for (const o of operators.value) {
    if (o.active) rows.set(o.id, { id: o.id, name: o.name, photo: o.photo, units: 0, value: 0, days: new Set(), areas: new Set(), active: true })
  }
  const photoOf = new Map(operators.value.map(o => [o.id, o.photo]))
  for (const e of entries.value) {
    const r = rows.get(e.operatorId) || { id: e.operatorId, name: e.operatorName, photo: photoOf.get(e.operatorId) || null, units: 0, value: 0, days: new Set<string>(), areas: new Set<string>(), active: false }
    r.units += e.totalUnits
    r.value += e.value
    r.days.add(e.date)
    if (e.area) r.areas.add(e.area)
    rows.set(e.operatorId, r)
  }
  return Array.from(rows.values()).sort((a, b) => b.units - a.units || a.name.localeCompare(b.name))
})
const maxOpUnits = computed(() => Math.max(1, ...perOperator.value.map(r => r.units)))

// Ritmo: por hora (un día) o por día (rango)
const hourFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'America/Guayaquil' })
const rhythm = computed(() => {
  if (single.value) {
    const byHour = new Map<number, number>()
    for (const e of entries.value) {
      const h = Number(hourFmt.format(new Date(e.createdAt)))
      byHour.set(h, (byHour.get(h) || 0) + e.totalUnits)
    }
    const hs = Array.from(byHour.keys())
    const start = Math.min(7, ...hs)
    const end = Math.max(18, ...hs)
    const cols = []
    for (let h = start; h <= end; h++) cols.push({ label: `${h}h`, units: byHour.get(h) || 0 })
    return cols
  }
  const byDay = new Map<string, number>()
  for (const e of entries.value) byDay.set(e.date, (byDay.get(e.date) || 0) + e.totalUnits)
  return rangeDays.value.map(d => ({ label: String(Number(d.slice(8))), units: byDay.get(d) || 0 }))
})
const maxRhythm = computed(() => Math.max(1, ...rhythm.value.map(c => c.units)))
const showRhythmNumbers = computed(() => rhythm.value.length <= 14)

const openOperator = (id: string) => emit('open-operator', id, to.value.slice(0, 7))

onMounted(() => {
  timer = setInterval(() => { if (includesToday.value && !document.hidden) loadRange(true) }, REFRESH_MS)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

</script>

<template>
  <div class="pp">
    <section class="hero">
      <div class="hero-head">
        <div>
          <h2>{{ title }}</h2>
          <p v-if="!ready && loading">Cargando…</p>
          <p v-else-if="isToday">
            Se actualiza sola cada 5 minutos.
            <template v-if="lastEntry">Último ingreso: <b>{{ lastEntry.operatorName }}, {{ timeOf(lastEntry.createdAt) }}</b>.</template>
            <template v-else>Todavía no hay ingresos hoy.</template>
          </p>
          <p v-else-if="single">
            <template v-if="lastEntry">Último ingreso: <b>{{ lastEntry.operatorName }}, {{ timeOf(lastEntry.createdAt) }}</b>.</template>
            <template v-else>Sin ingresos ese día.</template>
          </p>
          <p v-else>{{ prodDays }} de {{ rangeDays.length }} días con producción<template v-if="includesToday"> · incluye hoy, se actualiza sola</template>.</p>
        </div>
        <span v-if="includesToday" class="live">En vivo</span>
      </div>

      <div class="range">
        <div class="field">
          <label for="pp-from">Desde</label>
          <input id="pp-from" v-model="fromInput" type="date" :max="today" />
        </div>
        <div class="field">
          <label for="pp-to">Hasta</label>
          <input id="pp-to" v-model="toInput" type="date" :max="today" />
        </div>
        <p v-if="rangeError" class="rerr">{{ rangeError }}</p>
      </div>

      <p v-if="error" class="err">{{ error }} <button type="button" class="retry" @click="loadRange(true)">Reintentar</button></p>
      <p v-if="ready && !pricesOk" class="warn">Contífico no respondió: el valor a precio de venta puede salir en $0. Vuelve a cargar en unos minutos.</p>

      <div class="kpis" :class="{ dim: loading && !ready }">
        <div class="kpi">
          <span class="l">Unidades producidas</span>
          <span class="v">{{ units.toLocaleString('en-US') }}</span>
          <span v-if="single" class="h"><b>{{ productCount }}</b> productos distintos</span>
          <span v-else class="h">promedio <b>{{ prodDays ? Math.round(units / prodDays) : 0 }}</b> u por día con producción</span>
          <div class="split" aria-hidden="true">
            <span class="n" :style="{ width: units ? (nicoleUnits / units) * 100 + '%' : '0' }"></span>
            <span class="s" :style="{ width: units ? (sucreeUnits / units) * 100 + '%' : '0' }"></span>
          </div>
          <div class="legend"><span><i class="dot n"></i>Nicole <b>{{ nicoleUnits }}</b></span><span><i class="dot s"></i>Sucrée <b>{{ sucreeUnits }}</b></span></div>
        </div>
        <div class="kpi">
          <span class="l">Valor a precio de venta</span>
          <span class="v">{{ money(value) }}</span>
          <span class="h">sin IVA, referencial</span>
        </div>
        <div class="kpi">
          <span class="l">Operarios que registraron</span>
          <span class="v">{{ whoIds.size }} de {{ activeOperators.length }}</span>
          <span v-if="single" class="h"><b v-if="missingCount" class="amber">{{ missingCount }} sin registrar</b><template v-else>todos registraron</template></span>
          <span v-else class="h">con al menos un ingreso en el rango</span>
        </div>
        <div class="kpi">
          <span class="l">Ingresos en la tablet</span>
          <span class="v">{{ entries.length }}</span>
          <span v-if="single" class="h">
            <template v-if="entries.length">primero {{ timeOf(entries[0]!.createdAt) }} · último {{ timeOf(lastEntry!.createdAt) }}</template>
            <template v-else>sin ingresos</template>
          </span>
          <span v-else class="h">en {{ prodDays }} días</span>
        </div>
      </div>
    </section>

    <div class="grid2">
      <section class="sec">
        <h3>Qué se produjo</h3>
        <p class="hint">Todo lo registrado {{ single ? 'en el día' : 'en el rango' }}, sumado por producto y agrupado por área.</p>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Producto</th><th>Empresa</th><th class="r">Unidades</th><th class="r">Valor PVP</th><th class="r">Quién</th></tr></thead>
            <tbody v-if="!areas.length">
              <tr><td colspan="5" class="empty">No hay ingresos en estas fechas.</td></tr>
            </tbody>
            <tbody v-for="a in areas" :key="a.area">
              <tr class="arearow"><td colspan="5">{{ a.area }} · {{ a.units }} u</td></tr>
              <tr v-for="p in a.list" :key="p.key">
                <td class="p"><b>{{ p.name }}</b><small v-if="p.code">{{ p.code }}</small></td>
                <td><span class="brand" :class="p.company === 'sucree' ? 's' : 'n'">{{ p.company === 'sucree' ? 'Sucrée' : 'Nicole' }}</span></td>
                <td class="r"><b>{{ p.units }}</b></td>
                <td class="r">{{ money(p.value) }}</td>
                <td class="r"><span class="who"><span v-for="o in p.ops" :key="o">{{ o }}</span></span></td>
              </tr>
            </tbody>
            <tfoot v-if="areas.length">
              <tr><td>Total {{ single ? 'del día' : 'del rango' }}</td><td></td><td class="r">{{ units }}</td><td class="r">{{ money(value) }}</td><td></td></tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div class="side">
        <section class="sec">
          <h3>Por operario</h3>
          <p class="hint">{{ isToday ? 'Unidades de hoy.' : single ? 'Unidades del día.' : 'Unidades del rango y días con ingreso.' }} Toca un nombre para ver su ficha.</p>
          <div class="ops">
            <button v-for="r in perOperator" :key="r.id" type="button" class="oprow" :class="{ none: !r.units }" @click="openOperator(r.id)">
              <img v-if="r.photo" :src="r.photo" class="av" :alt="`Foto de ${r.name}`" />
              <span v-else class="av">{{ r.name.charAt(0).toUpperCase() }}</span>
              <span class="mid">
                <span class="nm">{{ r.name }}<small v-if="r.units">{{ Array.from(r.areas).join(', ') }}<template v-if="!single"> · {{ r.days.size }} {{ r.days.size === 1 ? 'día' : 'días' }}</template></small></span>
                <span v-if="r.units" class="bar"><span :style="{ width: (r.units / maxOpUnits) * 100 + '%' }"></span></span>
              </span>
              <span v-if="r.units" class="u">{{ r.units }} u ›<small>{{ money(r.value) }}</small></span>
              <span v-else class="badge">{{ single ? 'Sin registrar' : 'Sin ingresos' }}</span>
            </button>
            <p v-if="!perOperator.length" class="hint">No hay operarios. Agrégalos en Producción › Operarios.</p>
          </div>
        </section>

        <section class="sec">
          <h3>{{ single ? 'Ritmo del día' : 'Ritmo por día' }}</h3>
          <p class="hint">{{ single ? 'Unidades registradas por hora.' : 'Unidades registradas cada día del rango.' }}</p>
          <div class="chart" role="img" :aria-label="single ? 'Unidades por hora' : 'Unidades por día'">
            <div v-for="(c, i) in rhythm" :key="i" class="col">
              <span class="n">{{ showRhythmNumbers && c.units ? c.units : '' }}</span>
              <span class="b" :class="{ peak: c.units && c.units === maxRhythm }" :style="{ height: (c.units / maxRhythm) * 85 + '%' }"></span>
            </div>
          </div>
          <div class="labels">
            <span v-for="(c, i) in rhythm" :key="i">{{ rhythm.length > 14 && i % 3 ? '' : c.label }}</span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$violet: #3b1d6e;
$violet-2: #6d28d9;
$violet-soft: #f3e8ff;
$violet-line: #ddd6fe;
$line: #e8ecf2;
$muted: #64748b;
$faint: #94a3b8;
$nicole: #812a73;
$sucree: #b7791f;

.pp { display: flex; flex-direction: column; gap: 16px; }
.hero { border: 1.5px solid $violet-line; border-radius: 16px; background: linear-gradient(180deg, #faf5ff, #fff 70%); padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.hero-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;
  h2 { margin: 0; font-size: 1.15rem; font-weight: 800; color: $violet; &::first-letter { text-transform: uppercase; } }
  p { margin: 2px 0 0; font-size: .85rem; color: $muted; }
}
.live { display: inline-flex; align-items: center; gap: 6px; font-size: .75rem; font-weight: 800; color: #15803d; background: #ecfdf5; border-radius: 999px; padding: 4px 10px;
  &::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #15803d; }
}
.range { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.field { display: flex; flex-direction: column; gap: 3px;
  label { font-size: .66rem; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: $muted; }
  input { height: 38px; border: 1.5px solid $violet-line; border-radius: 10px; padding: 0 10px; font: inherit; font-weight: 700; color: #1e293b; background: #fff; }
  input:focus-visible { outline: 2px solid $violet-2; outline-offset: 1px; }
}
.rerr { flex-basis: 100%; margin: 0; color: #b91c1c; font-size: .82rem; font-weight: 700; }
.err { margin: 0; color: #b91c1c; background: #fef2f2; border-radius: 10px; padding: 8px 12px; font-size: .85rem; }
.retry { margin-left: 8px; border: 0; background: #b91c1c; color: #fff; border-radius: 8px; padding: 4px 10px; font: inherit; font-weight: 700; cursor: pointer; }
.warn { margin: 0; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 8px 12px; font-size: .85rem; }

.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; transition: opacity .2s;
  &.dim { opacity: .5; }
}
.kpi { background: #fff; border: 1px solid $line; border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 3px;
  .l { font-size: .68rem; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: $muted; }
  .v { font-size: 1.6rem; font-weight: 800; color: $violet; font-variant-numeric: tabular-nums; }
  .h { font-size: .78rem; color: $muted; b { color: #1e293b; } .amber { color: #b45309; } }
}
.split { display: flex; height: 8px; border-radius: 999px; overflow: hidden; background: $line; margin-top: 6px;
  span { display: block; height: 100%; } .n { background: $nicole; } .s { background: $sucree; }
}
.legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: .74rem; color: $muted; margin-top: 2px; b { color: #1e293b; } }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; &.n { background: $nicole; } &.s { background: $sucree; } }

.grid2 { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 16px; }
.side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.sec { border: 1px solid $line; border-radius: 16px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; min-width: 0; background: #fff;
  h3 { margin: 0; font-size: 1.02rem; color: $violet; }
  .hint { margin: 0; font-size: .8rem; color: $muted; }
}

.tbl-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .88rem; font-variant-numeric: tabular-nums; min-width: 480px; }
th { font-size: .66rem; text-transform: uppercase; letter-spacing: .5px; color: $faint; text-align: left; padding: 6px 8px; border-bottom: 1px solid $line; }
td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.r { text-align: right; }
td.p { b { display: block; font-weight: 700; } small { color: $faint; font-size: .74rem; } }
td.empty { text-align: center; color: $faint; padding: 20px; }
.arearow td { background: #f8fafc; font-size: .72rem; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; color: $muted; padding: 7px 8px; }
tfoot td { font-weight: 800; border-top: 2px solid $line; border-bottom: 0; }
.brand { display: inline-block; font-size: .68rem; font-weight: 800; border-radius: 5px; padding: 1px 6px;
  &.n { background: #f6e9f3; color: $nicole; } &.s { background: #fdf3e0; color: $sucree; }
}
.who { display: inline-flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;
  span { font-size: .7rem; font-weight: 700; background: #f8fafc; border: 1px solid $line; border-radius: 999px; padding: 1px 7px; color: $muted; }
}

.ops { display: flex; flex-direction: column; gap: 4px; }
.oprow { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 10px; align-items: center; width: 100%; border: 1px solid transparent; border-radius: 10px; background: #fff; padding: 6px; font: inherit; color: #1e293b; text-align: left; cursor: pointer;
  &:hover { border-color: #c4b5fd; background: #faf5ff; }
  &:focus-visible { outline: 2px solid $violet-2; outline-offset: 1px; }
  &.none .nm, &.none .av { opacity: .5; }
}
.av { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; display: grid; place-items: center; font-weight: 800; font-size: .85rem; color: #fff; background: linear-gradient(160deg, #c9a9c1, #7b2d6b); }
.mid { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.nm { font-weight: 700; display: flex; justify-content: space-between; gap: 8px; small { color: $faint; font-weight: 600; font-size: .74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }
.bar { display: block; height: 8px; background: #f1f5f9; border-radius: 999px; overflow: hidden; span { display: block; height: 100%; background: $violet-2; border-radius: 999px; } }
.u { font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; min-width: 60px; small { display: block; color: $faint; font-weight: 600; font-size: .72rem; } }
.badge { font-size: .7rem; font-weight: 800; border-radius: 999px; padding: 2px 8px; background: #fffbeb; color: #b45309; white-space: nowrap; }

.chart { display: flex; align-items: flex-end; gap: 4px; height: 120px; border-bottom: 1px solid $line; }
.col { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px;
  .n { font-size: .68rem; font-weight: 700; color: $muted; font-variant-numeric: tabular-nums; }
  .b { width: 100%; max-width: 32px; background: $violet-line; border-radius: 5px 5px 0 0; &.peak { background: $violet-2; } }
}
.labels { display: flex; gap: 4px; span { flex: 1; min-width: 0; text-align: center; font-size: .68rem; color: $faint; font-variant-numeric: tabular-nums; } }

@media (max-width: 900px) { .grid2 { grid-template-columns: 1fr; } }
</style>
