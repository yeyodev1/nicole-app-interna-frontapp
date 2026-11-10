<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ProductionService, { type FutureSales, type FutureSalesDay } from '@/services/production.service'


// Ventas a futuro (Orden 7): pedidos de clientes (delivery y pick up) pendientes de enviar,
// próximos 10 días desde mañana. Sin reposiciones de punto de venta. Solo lectura.
const brand = ref<'all' | 'nicole' | 'sucree'>('all')
const win = ref(0)
const data = ref<FutureSales | null>(null)
const counts = ref({ all: 0, nicole: 0, sucree: 0 })
const isLoading = ref(false)
const error = ref('')


const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const parse = (s: string) => { const [y = 0, m = 1, d = 1] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const dow = (s: string) => DOW[parse(s).getUTCDay()] ?? ''
const dm = (s: string) => s.slice(8, 10) + '/' + s.slice(5, 7)
const URGENT_DAYS = 3
const isUrgent = (s: string) => win.value === 0 && data.value ? data.value.days.findIndex(d => d.date === s) < URGENT_DAYS : false


const LEVELS: Record<FutureSalesDay['level'], { label: string; bar: string; fg: string; bg: string }> = {
  LIBRE: { label: 'LIBRE', bar: '#e2e8f0', fg: '#475569', bg: '#f1f5f9' },
  BAJO: { label: 'BAJO', bar: '#22c55e', fg: '#166534', bg: '#dcfce7' },
  MEDIO: { label: 'MEDIO', bar: '#f59e0b', fg: '#92400e', bg: '#fef3c7' },
  ALTO: { label: 'ALTO', bar: '#ea580c', fg: '#9a3412', bg: '#ffedd5' },
  MAS_COMPROMETIDO: { label: 'MÁS COMPROMETIDO', bar: '#dc2626', fg: '#991b1b', bg: '#fee2e2' },
}


const maxUnits = computed(() => Math.max(1, ...(data.value?.days.map(d => d.units) || [0])))
const summary = computed(() => {
  const d = data.value
  if (!d || !d.totals.units || !d.maxDay) return 'Sin entregas pendientes en estos 10 días'
  const top = d.days.find(x => x.date === d.maxDay)!
  return `Día más comprometido: ${dow(top.date)} ${dm(top.date)} con ${top.units} unids y ${top.orders} pedido(s) · ` +
    `${d.totals.units} unids y ${d.totals.orders} pedidos en los 10 días (${d.totals.delivery} delivery, ${d.totals.pickup} pick up)`
})


async function load() {
  isLoading.value = true
  error.value = ''
  try {
    const src = brand.value === 'all' ? undefined : brand.value
    const [main, all, nic, suc] = await Promise.all([
      ProductionService.getFutureSales(win.value, src),
      ProductionService.getFutureSales(win.value),
      ProductionService.getFutureSales(win.value, 'nicole'),
      ProductionService.getFutureSales(win.value, 'sucree'),
    ])
    data.value = main
    counts.value = { all: all.totals.orders, nicole: nic.totals.orders, sucree: suc.totals.orders }
  } catch (e: any) {
    error.value = 'No se pudo cargar ventas a futuro: ' + (e?.response?.data?.message || e?.message || '')
  } finally {
    isLoading.value = false
  }
}
const setBrand = (b: 'all' | 'nicole' | 'sucree') => { brand.value = b; load() }
const move = (n: number) => { win.value = Math.max(0, win.value + n); load() }
onMounted(load)
</script>


<template>
  <div class="fs-page">
    <header class="fs-header">
      <div class="top">
        <div>
          <h1>Ventas a futuro</h1>
          <p>Lo pendiente de enviar de pedidos de clientes (delivery y pick up), por producto y por día, del más pedido al menos pedido.</p>
        </div>
        <button type="button" class="btn-refresh" :disabled="isLoading" @click="load">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i> Actualizar
        </button>
      </div>
      <div class="row" role="group" aria-label="Marca">
        <button v-for="b in (['all', 'nicole', 'sucree'] as const)" :key="b" type="button" class="pill"
          :class="{ on: brand === b }" :aria-pressed="brand === b" @click="setBrand(b)">
          {{ b === 'all' ? 'Todas' : b === 'nicole' ? 'Nicole' : 'Sucree' }} <span class="c">{{ counts[b] }}</span>
        </button>
      </div>
      <div class="row">
        <span class="lbl">PENDIENTE DE ENVIAR · 10 DÍAS</span>
        <button type="button" class="per" :disabled="win === 0" @click="move(-1)">&larr; Anteriores</button>
        <span v-if="data" class="range">{{ dow(data.from) }} {{ dm(data.from) }} al {{ dow(data.to) }} {{ dm(data.to) }}</span>
        <button type="button" class="per" @click="move(1)">Siguientes &rarr;</button>
      </div>
    </header>


    <div class="fs-body">
      <p v-if="error" class="note err">{{ error }}</p>
      <p v-if="data && data.unpaid.length" class="note">
        <b>Pago pendiente:</b>
        <span v-for="(u, i) in data.unpaid" :key="i">{{ i ? ' · ' : ' ' }}{{ dm(u.date) }} {{ u.customer }} (${{ u.pending.toFixed(2) }})</span>.
        Incluidos en las cantidades.
      </p>


      <section v-if="data" class="card traf" aria-label="Tráfico de entregas por día">
        <h2>Tráfico y saturación por día</h2>
        <p class="sub">{{ summary }}</p>
        <div class="cols">
          <div v-for="d in data.days" :key="d.date" class="tc" :class="{ top: d.level === 'MAS_COMPROMETIDO' }"
            :aria-label="`${dm(d.date)}: ${d.units} unidades, ${d.delivery} delivery, ${d.pickup} pick up, ${LEVELS[d.level].label}`">
            <span class="dw">{{ dow(d.date).toUpperCase() }}</span>
            <span class="dd">{{ dm(d.date) }}</span>
            <span class="bx"><i v-if="d.units" :style="{ height: Math.max(6, Math.round(84 * d.units / maxUnits)) + 'px', background: LEVELS[d.level].bar }"></i></span>
            <span class="u">{{ d.units }} u</span>
            <span class="p">{{ d.orders }} pedido(s){{ d.units ? ` · ${d.percentOfMax}%` : '' }}</span>
            <span class="p">Delivery {{ d.delivery }} · Pick up {{ d.pickup }}</span>
            <span class="lv" :style="{ background: LEVELS[d.level].bg, color: LEVELS[d.level].fg }">{{ LEVELS[d.level].label }}</span>
          </div>
        </div>
        <p class="legend">Cada día se compara con el día más comprometido de estos 10 días (= 100%). Alto: 70% o más · Medio: 40% a 69% · Bajo: menos de 40%.</p>
      </section>


      <div v-if="data && !data.products.length" class="empty">No hay entregas pendientes en estos 10 días.</div>


      <div v-if="data && data.products.length" class="card tbl">
        <table>
          <thead>
            <tr>
              <th scope="col" class="ctr">#</th>
              <th scope="col">PRODUCTO</th>
              <th scope="col" class="ctr total">TOTAL</th>
              <th v-for="d in data.days" :key="d.date" scope="col" class="ctr" :class="{ urg: isUrgent(d.date) }">
                {{ dow(d.date).toUpperCase() }}<br><span class="thd">{{ dm(d.date) }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in data.products" :key="p.name">
              <td class="ctr idx">{{ i + 1 }}</td>
              <td class="name">{{ p.name }}</td>
              <td class="ctr tot">{{ p.total }}</td>
              <td v-for="d in data.days" :key="d.date" class="ctr" :class="{ urg: isUrgent(d.date), has: p.perDay[d.date], empty: !p.perDay[d.date] }">
                {{ p.perDay[d.date] || '·' }}
              </td>
            </tr>
            <tr class="foot">
              <td></td>
              <td class="name">TOTAL DEL DÍA</td>
              <td class="ctr grand">{{ data.totals.units }}</td>
              <td v-for="d in data.days" :key="d.date" class="ctr">{{ d.units || '·' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>


<style lang="scss" scoped>
.fs-page { display: flex; flex-direction: column; min-height: 100%; background: #f5f6f8; color: #1e293b; }
.fs-header { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 22px 28px 18px; display: flex; flex-direction: column; gap: 14px;
  .top { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: flex-start; }
  h1 { margin: 0; font-size: 24px; font-weight: 800; }
  p { margin: 4px 0 0; font-size: 13px; color: #64748b; }
}
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.lbl { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #64748b; }
.range { font-size: 13px; font-weight: 700; color: #334155; }
.btn-refresh { min-height: 40px; padding: 0 16px; border-radius: 8px; border: 1px solid #93c5fd; background: #fff; color: #2563eb; font-weight: 700; font-size: 13px; cursor: pointer; }
.pill { display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 700; background: #fff; color: #334155; border: 1px solid #e2e8f0; cursor: pointer;
  .c { font-size: 11px; font-weight: 800; border-radius: 999px; padding: 1px 7px; background: #f1f5f9; color: #475569; }
  &.on { background: #1e293b; color: #fff; border-color: #1e293b; .c { background: #475569; color: #fff; } }
}
.per { min-height: 36px; padding: 0 14px; border-radius: 10px; font-size: 13px; font-weight: 700; background: #fff; color: #334155; border: 1px solid #e2e8f0; cursor: pointer;
  &:disabled { opacity: .4; cursor: not-allowed; }
}
.fs-body { padding: 22px 28px 40px; display: flex; flex-direction: column; gap: 18px; max-width: 1240px; width: 100%; box-sizing: border-box; }
.note { margin: 0; font-size: 12px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; &.err { color: #991b1b; background: #fee2e2; border-color: #fecaca; } }
.card { background: #fff; border: 1px solid #e9eef5; border-radius: 14px; }
.traf { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px;
  h2 { margin: 0; font-size: 15px; font-weight: 800; }
  .sub { margin: 0; font-size: 13px; color: #64748b; }
  .legend { margin: 0; font-size: 12px; color: #475569; }
}
.cols { display: grid; grid-template-columns: repeat(10, minmax(72px, 1fr)); gap: 8px; overflow-x: auto; }
.tc { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 10px; border: 1px solid #e2e8f0;
  &.top { border: 2px solid #dc2626; }
  .dw { font-size: 11px; font-weight: 700; color: #64748b; } .dd { font-size: 14px; font-weight: 800; }
  .bx { height: 90px; width: 100%; display: flex; align-items: flex-end; justify-content: center; background: #f8fafc; border-radius: 6px; i { display: block; width: 60%; border-radius: 5px 5px 0 0; } }
  .u { font-size: 15px; font-weight: 800; } .p { font-size: 11px; color: #64748b; text-align: center; }
  .lv { font-size: 10px; font-weight: 800; letter-spacing: .5px; border-radius: 999px; padding: 2px 7px; text-align: center; }
}
.tbl { overflow-x: auto; }
table { width: 100%; min-width: 980px; border-collapse: collapse; font-size: 13px;
  th, td { border: 1px solid #d9dee5; padding: 10px 14px; }
  th { text-align: left; font-size: 11px; letter-spacing: .6px; color: #64748b; background: #f8fafc; border-bottom: 2px solid #c3c9d2; white-space: nowrap; }
  .thd { font-size: 13px; font-weight: 800; letter-spacing: 0; }
  .ctr { text-align: center; }
  th.total, td.grand { background: #1e293b; color: #fff; font-weight: 800; }
  td.tot { background: #f1f5f9; font-weight: 800; }
  th.urg { background: #fff7ed; color: #9a3412; } td.urg { background: #fffaf5; }
  td.has { font-weight: 800; } td.urg.has { color: #c2410c; } td.empty { color: #cbd5e1; }
  .idx { color: #64748b; font-weight: 700; } .name { font-weight: 600; }
  tr.foot td { font-weight: 800; border-top: 2px solid #cbd5e1; }
}
.empty { padding: 40px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 14px; background: #fff; }
</style>
