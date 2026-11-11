<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  productionHistoryService,
  type ProductionHistory,
  type HistoryEntry,
  money,
  tierOf,
  longDate,
  monthLabel,
} from '@/services/production-history.service'
import ProductionEntryCard from './components/ProductionEntryCard.vue'

/** Histórico de producción: solo lo ve el Jefe de Operaciones. */
const router = useRouter()
const history = ref<ProductionHistory | null>(null)
const loading = ref(true)
const error = ref('')
const month = ref('')
const daysShown = ref(3)

async function load(m?: string) {
  loading.value = true
  error.value = ''
  try {
    history.value = await productionHistoryService.getHistory(m)
    month.value = history.value.month
  } catch (e: any) {
    error.value = e?.message || 'No se pudo cargar el histórico.'
  } finally {
    loading.value = false
  }
}

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number)
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + delta, 1))
  const next = d.toISOString().slice(0, 7)
  if (history.value && next > history.value.today.slice(0, 7)) return
  daysShown.value = 3
  load(next)
}

const isCurrentMonth = computed(() => !!history.value && month.value === history.value.today.slice(0, 7))
const photoOf = computed(() => new Map((history.value?.operators || []).map(o => [o.id, o.photo])))
const days = computed(() => {
  const byDay = new Map<string, HistoryEntry[]>()
  for (const e of history.value?.entries || []) byDay.set(e.date, [...(byDay.get(e.date) || []), e])
  return Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]))
})

function openOperator(id: string) {
  router.push({ name: 'operations-production-operator', params: { id }, query: { month: month.value } })
}

onMounted(() => load())
</script>

<template>
  <div class="ph-page">
    <header class="top">
      <div class="ic"><i class="fa-solid fa-chart-column"></i></div>
      <div class="tt">
        <h1>Histórico de producción</h1>
        <p>Lo que registra cada operario en la tablet de planta.</p>
      </div>
      <div class="month">
        <button aria-label="Mes anterior" @click="shiftMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
        <span class="pill"><i class="fa-regular fa-calendar"></i> {{ month ? monthLabel(month) : '…' }}</span>
        <button aria-label="Mes siguiente" :disabled="isCurrentMonth" @click="shiftMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
    </header>

    <div v-if="loading && !history" class="sec muted">Cargando…</div>
    <div v-else-if="error" class="sec"><p class="error">{{ error }}</p><button class="btn" @click="load(month || undefined)">Reintentar</button></div>

    <template v-if="history">
      <p v-if="!history.pricesAvailable" class="warn">Contífico no respondió: el valor a precio de venta puede salir en $0. Vuelve a cargar en unos minutos.</p>

      <div class="kpis">
        <div class="kpi"><span class="l">Unidades del mes</span><span class="v">{{ history.totals.units.toLocaleString('en-US') }}</span><span class="h">{{ history.totals.entries }} ingresos</span></div>
        <div class="kpi"><span class="l">Valor a precio de venta</span><span class="v">{{ money(history.totals.value) }}</span><span class="h">sin IVA, referencial</span></div>
        <div class="kpi"><span class="l">Operarios activos</span><span class="v">{{ history.totals.activeOperators }}</span><span class="h">descansos rotativos</span></div>
        <div class="kpi multa"><span class="l">Multas del mes</span><span class="v">{{ money(history.totals.fines) }}</span><span class="h">semanas cerradas · {{ history.totals.extraDays }} días de más sin ingreso</span></div>
      </div>

      <section class="sec">
        <h2>Fichas de rendimiento</h2>
        <p class="hint">Ordenadas por índice del mes. Toca una para ver el detalle.</p>
        <div v-if="history.operators.length" class="cards">
          <button v-for="o in history.operators" :key="o.id" class="op" @click="openOperator(o.id)">
            <div class="hd">
              <img v-if="o.photo" :src="o.photo" class="av" :alt="`Foto de ${o.name}`" />
              <span v-else class="av">{{ o.name.charAt(0).toUpperCase() }}</span>
              <div>
                <div class="nm">{{ o.name }}<span v-if="!o.active" class="off"> · dado de baja</span></div>
                <div class="ar">{{ o.mainArea || 'Sin ingresos este mes' }}</div>
              </div>
              <div class="score" :class="tierOf(o.score.index).cls">{{ o.score.index }}<small>{{ tierOf(o.score.index).label }}</small></div>
            </div>
            <div class="st">
              <div>Unidades<b>{{ o.units }}</b></div>
              <div>Valor PVP<b>{{ money(o.value).replace(/\.\d+$/, '') }}</b></div>
              <div>Días<b>{{ o.daysWithEntry }}</b></div>
            </div>
            <div v-if="o.fines" class="mrow">Multas: <b>{{ money(o.fines) }}</b> · {{ o.extraDays }} {{ o.extraDays === 1 ? 'día' : 'días' }} de más sin ingreso</div>
            <div v-else class="mrow ok0">Sin multas</div>
          </button>
        </div>
        <p v-else class="muted">No hay operarios. Agrégalos en Producción › Operarios.</p>
      </section>

      <section class="sec">
        <h2>Últimos ingresos</h2>
        <p class="hint">Uno detrás de otro, como llegan de la tablet.</p>
        <div v-if="days.length" class="feed">
          <template v-for="[day, list] in days.slice(0, daysShown)" :key="day">
            <div class="day">
              <b>{{ day === history.today ? 'Hoy · ' + longDate(day) : longDate(day) }}</b>
              <span>{{ list.length }} ingresos · {{ list.reduce((s, e) => s + e.totalUnits, 0) }} unidades</span>
            </div>
            <ProductionEntryCard v-for="e in list" :key="e.id" :entry="e" :photo="photoOf.get(e.operatorId)" />
          </template>
          <button v-if="days.length > daysShown" class="btn ghost" @click="daysShown += 5">Ver días anteriores</button>
        </div>
        <p v-else class="muted">Todavía no hay ingresos este mes.</p>
      </section>
    </template>
  </div>
</template>

<style lang="scss" scoped>
@use './production-history.scss';
</style>
