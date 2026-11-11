<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  productionHistoryService,
  type ProductionHistory,
  money,
  tierOf,
  longDate,
  monthLabel,
} from '@/services/production-history.service'
import ProductionEntryCard from './components/ProductionEntryCard.vue'

/** Ficha de rendimiento mensual de un operario (formato del reporte de Frank). */
const route = useRoute()
const router = useRouter()
const history = ref<ProductionHistory | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    history.value = await productionHistoryService.getHistory(String(route.query.month || '') || undefined)
  } catch (e: any) {
    error.value = e?.message || 'No se pudo cargar la ficha.'
  } finally {
    loading.value = false
  }
}

const op = computed(() => history.value?.operators.find(o => o.id === String(route.params.id)) || null)
const entries = computed(() => (history.value?.entries || []).filter(e => e.operatorId === op.value?.id))
const tier = computed(() => tierOf(op.value?.score.index ?? 0))
const rules = computed(() => history.value?.rules)

const unitsByDay = computed(() => {
  const m = new Map<string, number>()
  for (const e of entries.value) m.set(e.date, (m.get(e.date) || 0) + e.totalUnits)
  return m
})

const calendar = computed(() => {
  if (!history.value) return []
  const [y, mo] = history.value.month.split('-').map(Number)
  const year = y ?? 2026
  const month = (mo ?? 1) - 1
  const first = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7 // lunes = 0
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: Array<{ day: number | null; iso?: string; units?: number; future?: boolean }> = []
  for (let i = 0; i < first; i++) cells.push({ day: null })
  for (let d = 1; d <= last; d++) {
    const iso = `${history.value.month}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, iso, units: unitsByDay.value.get(iso) || 0, future: iso > history.value.today })
  }
  return cells
})

const products = computed(() => {
  const m = new Map<string, { name: string; code: string; quantity: number; value: number }>()
  for (const e of entries.value) for (const i of e.items) {
    const p = m.get(i.code) || { name: i.name, code: i.code, quantity: 0, value: 0 }
    p.quantity += i.quantity
    p.value += i.quantity * i.unitPrice
    m.set(i.code, p)
  }
  return Array.from(m.values()).sort((a, b) => b.quantity - a.quantity)
})
const maxQty = computed(() => products.value[0]?.quantity || 1)

const weekRange = (from: string, to: string) => {
  const f = new Date(`${from}T12:00:00`), t = new Date(`${to}T12:00:00`)
  const opt: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
  return `${f.toLocaleDateString('es-EC', opt)} – ${t.toLocaleDateString('es-EC', opt)}`
}
const runningWeek = computed(() => op.value?.weeks.find(w => !w.closed) || null)
const productivityDiff = computed(() =>
  op.value && op.value.areaUnitsPerDay ? Math.round((op.value.unitsPerDay / op.value.areaUnitsPerDay - 1) * 100) : null
)

watch(() => route.query.month, load)
onMounted(load)
</script>

<template>
  <div class="ph-page">
    <button class="back" @click="router.push({ name: 'operations-production-history' })">← Volver al histórico</button>

    <div v-if="loading && !history" class="sec muted">Cargando…</div>
    <div v-else-if="error" class="sec"><p class="error">{{ error }}</p><button class="btn" @click="load">Reintentar</button></div>
    <div v-else-if="history && !op" class="sec muted">Este operario no tiene ficha en {{ monthLabel(history.month) }}.</div>

    <template v-if="history && op && rules">
      <div class="hero">
        <img v-if="op.photo" :src="op.photo" class="av" :alt="`Foto de ${op.name}`" />
        <span v-else class="av">{{ op.name.charAt(0).toUpperCase() }}</span>
        <div class="who">
          <h1>{{ op.name }}</h1>
          <div class="meta">{{ op.mainArea || 'Sin ingresos' }} · Producción<br />Período: <span class="cap">{{ monthLabel(history.month) }}</span> · Fuente: tablet de producción</div>
        </div>
        <div class="big" :class="tier.cls"><div class="t">Índice</div><div class="n">{{ op.score.index }}</div><div class="q">{{ tier.label }}</div></div>
      </div>

      <div class="kpis">
        <div class="kpi"><span class="l">Unidades producidas</span><span class="v">{{ op.units }}</span><span class="h">{{ op.entries }} ingresos</span></div>
        <div class="kpi"><span class="l">Valor a precio de venta</span><span class="v">{{ money(op.value) }}</span><span class="h">sin IVA, referencial</span></div>
        <div class="kpi"><span class="l">Unidades por día</span><span class="v">{{ op.unitsPerDay.toFixed(1) }}</span><span class="h">Área: {{ op.areaUnitsPerDay.toFixed(1) }} u/día</span></div>
        <div class="kpi"><span class="l">Días con registro</span><span class="v">{{ op.score.registro }}%</span><span class="h">{{ op.daysWithEntry }} de {{ op.expectedDays }} días esperados</span></div>
        <div class="kpi multa"><span class="l">Multas del mes</span><span class="v">{{ money(op.fines) }}</span><span class="h">${{ rules.finePerDay }} por día de más sin ingreso</span></div>
      </div>

      <section class="sec">
        <h2>Multas por semana</h2>
        <p class="hint">Se permiten {{ rules.freeDaysPerWeek }} días sin ingreso por semana (descansos rotativos). Desde el {{ rules.freeDaysPerWeek + 1 }}.º, cada día suma ${{ rules.finePerDay }}. Se calcula al cerrar la semana (domingo).</p>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Semana</th><th class="r">Días sin ingreso</th><th class="r">Permitidos</th><th class="r">De más</th><th class="r">Multa</th></tr></thead>
            <tbody>
              <tr v-for="w in op.weeks" :key="w.from">
                <td class="cap">{{ weekRange(w.from, w.to) }}<span v-if="!w.closed" class="tag-run">En curso</span></td>
                <td class="r">{{ w.daysWithoutEntry }}</td>
                <td class="r">{{ w.freeDays }}</td>
                <td class="r">{{ w.closed ? w.extraDays : '—' }}</td>
                <td class="r"><template v-if="w.closed"><b v-if="w.fine" class="bad">{{ money(w.fine) }}</b><template v-else>$0.00</template></template><template v-else>Se calcula el domingo</template></td>
              </tr>
              <tr><td><b>Total del mes</b></td><td></td><td></td><td></td><td class="r"><b>{{ money(op.fines) }}</b></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="split">
        <section class="sec">
          <h2>Calendario del mes</h2>
          <div class="cal">
            <div v-for="d in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']" :key="d" class="dn">{{ d }}</div>
            <template v-for="(c, ix) in calendar" :key="ix">
              <div v-if="!c.day" class="c blank"></div>
              <div v-else-if="c.future" class="c fut">{{ c.day }}</div>
              <div v-else-if="c.units" class="c">{{ c.day }}<b>{{ c.units }}</b></div>
              <div v-else class="c rest">{{ c.day }}<b>Sin ingreso</b></div>
            </template>
          </div>
          <div class="legend">
            <span><i class="lg-on"></i>Unidades del día</span>
            <span><i class="lg-rest"></i>Sin ingreso (descanso u olvido)</span>
          </div>
        </section>

        <section class="sec">
          <h2>Cómo se calcula el índice</h2>
          <table class="idx">
            <tbody>
              <tr><td>Registro diario en la app</td><td>{{ Math.round(rules.weights.registro * 100) }}%</td><td>{{ op.score.registro }}</td></tr>
              <tr><td>Productividad vs área (u/día)</td><td>{{ Math.round(rules.weights.productividad * 100) }}%</td><td>{{ op.score.productividad }}</td></tr>
              <tr><td>Valor producido vs área</td><td>{{ Math.round(rules.weights.valor * 100) }}%</td><td>{{ op.score.valor }}</td></tr>
              <tr class="tot"><td>Índice del mes</td><td></td><td>{{ op.score.index }}</td></tr>
            </tbody>
          </table>
          <span class="scale">90+ Destacado · 80–89 Bueno · 65–79 Por mejorar · &lt;65 Crítico.</span>
          <h2>Puntos de atención</h2>
          <div class="alerts">
            <div v-if="op.fines" class="al r"><b>Multa de {{ money(op.fines) }}:</b> {{ op.extraDays }} {{ op.extraDays === 1 ? 'día' : 'días' }} sin ingreso por encima de los {{ rules.freeDaysPerWeek }} permitidos por semana.</div>
            <div v-else class="al g"><b>Sin multas:</b> respetó los {{ rules.freeDaysPerWeek }} días sin ingreso por semana.</div>
            <div v-if="runningWeek && runningWeek.daysWithoutEntry > rules.freeDaysPerWeek" class="al a"><b>Semana en curso:</b> ya lleva {{ runningWeek.daysWithoutEntry }} días sin ingreso; desde el {{ rules.freeDaysPerWeek + 1 }}.º se cobrará al cerrar la semana.</div>
            <div v-if="productivityDiff !== null" class="al" :class="productivityDiff < 0 ? 'a' : 'g'"><b>Productividad {{ Math.abs(productivityDiff) }}% {{ productivityDiff < 0 ? 'bajo' : 'sobre' }} el promedio del área:</b> {{ op.unitsPerDay.toFixed(1) }} u/día frente a {{ op.areaUnitsPerDay.toFixed(1) }} u/día.</div>
          </div>
        </section>
      </div>

      <section class="sec">
        <h2>Producción por producto</h2>
        <div v-if="products.length" class="tbl-wrap">
          <table>
            <thead><tr><th>Producto</th><th>Código</th><th class="barcol"></th><th class="r">Unid.</th><th class="r">% del mes</th><th class="r">Valor PVP sin IVA</th></tr></thead>
            <tbody>
              <tr v-for="p in products" :key="p.code">
                <td>{{ p.name }}</td><td>{{ p.code }}</td>
                <td><div class="bar" :style="{ width: Math.round(p.quantity / maxQty * 100) + '%' }"></div></td>
                <td class="r">{{ p.quantity }}</td><td class="r">{{ op.units ? Math.round(p.quantity / op.units * 100) : 0 }}%</td><td class="r">{{ money(p.value) }}</td>
              </tr>
              <tr><td><b>Total</b></td><td></td><td></td><td class="r"><b>{{ op.units }}</b></td><td class="r"><b>100%</b></td><td class="r"><b>{{ money(op.value) }}</b></td></tr>
            </tbody>
          </table>
        </div>
        <p v-else class="muted">Sin producción registrada este mes.</p>
      </section>

      <section class="sec">
        <h2>Ingresos de {{ op.name }}</h2>
        <div v-if="entries.length" class="feed">
          <template v-for="e in entries" :key="e.id">
            <div class="day"><b>{{ longDate(e.date) }}</b></div>
            <ProductionEntryCard :entry="e" :photo="op.photo" />
          </template>
        </div>
        <p v-else class="muted">Sin ingresos este mes.</p>
      </section>
    </template>
  </div>
</template>

<style lang="scss" scoped>
@use './production-history.scss';

.back { font: inherit; font-weight: 700; color: #6d28d9; background: none; border: none; cursor: pointer; padding: 0; align-self: flex-start; }
.cap { text-transform: capitalize; }
.bad { color: #b91c1c; }
.hero { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; border: 1px solid #e8ecf2; border-radius: 16px; padding: 18px;
  .av { width: 84px; height: 84px; font-size: 2rem; }
  .who { flex: 1; min-width: 180px; }
  h1 { margin: 0; font-size: 1.7rem; font-weight: 800; }
  .meta { color: #64748b; font-size: .88rem; margin-top: 4px; line-height: 1.6; }
}
.big { text-align: center; border-radius: 14px; padding: 12px 22px;
  .t { font-size: .66rem; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; margin-bottom: 4px; }
  .n { font-size: 2.4rem; font-weight: 800; line-height: 1; }
  .q { font-weight: 800; font-size: .85rem; margin-top: 4px; }
}
.tag-run { font-size: .68rem; font-weight: 700; color: #6d28d9; background: #f3e8ff; padding: 2px 7px; border-radius: 999px; margin-left: 6px; text-transform: none; }
.split { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; }
.cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px;
  .dn { font-size: .66rem; color: #64748b; text-align: center; font-weight: 700; }
  .c { min-height: 52px; border-radius: 8px; padding: 4px 6px; display: flex; flex-direction: column; justify-content: space-between; background: #f3e8ff; font-size: .66rem; color: #64748b;
    b { font-size: 1.05rem; color: #3b1d6e; text-align: right; font-variant-numeric: tabular-nums; }
    &.rest { background: #f8fafc; b { font-size: .62rem; color: #64748b; } }
    &.fut { background: transparent; border: 1px dashed #e8ecf2; }
    &.blank { background: transparent; }
  }
}
.legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: .75rem; color: #64748b;
  i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
  .lg-on { background: #f3e8ff; border: 1px solid #ddd6fe; }
  .lg-rest { background: #f8fafc; border: 1px solid #e8ecf2; }
}
.idx td:last-child { text-align: right; font-weight: 700; }
.idx tr.tot td { font-weight: 800; color: #6d28d9; font-size: 1rem; border-bottom: none; }
.scale { font-size: .74rem; color: #64748b; }
.alerts { display: flex; flex-direction: column; gap: 8px; }
.al { border-radius: 10px; padding: 10px 12px; font-size: .86rem; border-left: 4px solid;
  &.r { background: #fef2f2; border-color: #b91c1c; }
  &.a { background: #fffbeb; border-color: #d97706; }
  &.g { background: #ecfdf5; border-color: #15803d; }
}
.barcol { width: 30%; }
.bar { height: 8px; border-radius: 999px; background: #6d28d9; min-width: 4px; }
@media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
</style>
