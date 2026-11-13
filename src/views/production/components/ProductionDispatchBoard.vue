<script setup lang="ts">
import { ref, computed, toRef } from 'vue'
import { useDispatchBoard, type BoardProduct } from '../composables/useDispatchBoard'

/**
 * Resumen de Producción · despacho por local.
 * "Todos los locales": solo lectura. San Marino / Mall del Sol: despacho de reposición
 * por producto. Delivery / Centro de producción: solo lectura (se despacha en Órdenes).
 */
const props = defineProps<{
  orders: any[]
  destOf: (o: any) => string
  categoryOf: (name: string, raw?: string) => string
  categoryOrder: string[]
  /** Día (YYYY-MM-DD) al que se despacha; null si el filtro no es un solo día. */
  sendDate: string | null
  sendingKey: string | null
}>()

const emit = defineEmits<{
  (e: 'send', payload: { local: string; name: string; quantity: number; key: string }): void
  (e: 'go-orders'): void
}>()

const {
  categories, locals, cellOf, pendingOf, restockPendingOf, orderedAll, sentAll, pendingAll, localPending, totalPending,
} = useDispatchBoard(toRef(props, 'orders'), props.destOf, props.categoryOf, props.categoryOrder)

const filter = ref<string>('all')
const current = computed(() => locals.value.find(l => l.key === filter.value) || null)

const CAT_COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']
const catClass = (i: number) => CAT_COLORS[i % CAT_COLORS.length]

// Categorías con algo pedido en el local elegido (o en cualquiera para "Todos")
const visibleCategories = computed(() =>
  categories.value
    .map((c, i) => ({
      ...c,
      cls: catClass(i),
      products: c.products.filter(p => (filter.value === 'all' ? orderedAll(p) : cellOf(p, filter.value).ordered) > 0 || (filter.value !== 'all' && cellOf(p, filter.value).sent > 0)),
    }))
    .filter(c => c.products.length > 0),
)

// ── Casilla "Enviar reposición": ya llena con lo pendiente de reposición ──
const drafts = ref<Record<string, number>>({})
const rowKey = (local: string, name: string) => `${local}|||${name}`
const draftOf = (p: BoardProduct) => {
  const k = rowKey(filter.value, p.name)
  return drafts.value[k] ?? restockPendingOf(p, filter.value)
}
const setDraft = (p: BoardProduct, v: number) => {
  drafts.value[rowKey(filter.value, p.name)] = Math.max(0, Math.round(Number(v) || 0))
}
const afterSend = (p: BoardProduct) => {
  const c = cellOf(p, filter.value)
  return c.restockSent + draftOf(p) - c.restockOrdered
}

const send = (p: BoardProduct) => {
  const quantity = draftOf(p)
  if (!quantity || !props.sendDate || props.sendingKey) return
  const key = rowKey(filter.value, p.name)
  emit('send', { local: filter.value, name: p.name, quantity, key })
}
/** Lo llama la pantalla cuando el envío quedó guardado: la casilla vuelve a lo pendiente. */
const resetDraft = (key: string) => { delete drafts.value[key] }
defineExpose({ resetDraft })

const localProgress = computed(() => {
  if (filter.value === 'all') return `faltan ${totalPending.value} unids por enviar`
  let rows = 0, done = 0
  for (const c of visibleCategories.value) for (const p of c.products) { rows++; if (!pendingOf(p, filter.value)) done++ }
  return `${done} de ${rows} productos completos · faltan ${localPending(filter.value)} unids`
})

const catPending = (products: BoardProduct[]) => products.reduce((s, p) => s + pendingOf(p, filter.value), 0)
const catOrderedAll = (products: BoardProduct[]) => products.reduce((s, p) => s + orderedAll(p), 0)
const catOrderedLocal = (products: BoardProduct[], local: string) => products.reduce((s, p) => s + cellOf(p, local).ordered, 0)
</script>

<template>
  <div class="dispatch-board">
    <div class="loc-label">Ver local</div>
    <div class="locs" role="tablist" aria-label="Filtrar por local">
      <button type="button" class="loc" :class="{ on: filter === 'all' }" role="tab" :aria-selected="filter === 'all'" @click="filter = 'all'">
        <span class="ico">Σ</span>
        <span>Todos los locales<small>faltan {{ totalPending }} unids</small></span>
      </button>
      <button
        v-for="l in locals"
        :key="l.key"
        type="button"
        class="loc"
        :class="{ on: filter === l.key }"
        role="tab"
        :aria-selected="filter === l.key"
        @click="filter = l.key"
      >
        <span class="ico"><i class="fas" :class="l.icon"></i></span>
        <span>{{ l.label }}<small>faltan {{ localPending(l.key) }} unids</small></span>
      </button>
    </div>

    <section class="board">
      <div class="board-head">
        <div>
          <h2 v-if="filter === 'all'">Pendiente · todos los locales</h2>
          <h2 v-else-if="current?.canSend">Despacho de reposición · {{ current.label }}</h2>
          <h2 v-else>Pendiente · {{ current?.label }}</h2>
          <p v-if="filter === 'all'">Verde = enviado completo · Amarillo = enviado de menos · Morado = enviado de más · Normal = falta enviar</p>
          <p v-else-if="current?.canSend">Aquí se despacha solo la reposición. La cantidad ya viene escrita: ajústala si hace falta y toca Enviar</p>
          <p v-else>Solo lectura: estos pedidos son de clientes y se despachan uno por uno en Órdenes</p>
        </div>
        <div class="progress">{{ localProgress }}</div>
      </div>

      <div v-if="current?.canSend && !sendDate" class="date-warn">
        <i class="fas fa-info-circle"></i> Para despachar, elige <b>Hoy</b> o <b>Mañana</b> arriba: el envío se registra a la reposición de ese día.
      </div>

      <div v-if="visibleCategories.length === 0" class="empty">No hay pedidos para este local en el periodo elegido.</div>

      <!-- TODOS LOS LOCALES (solo lectura) -->
      <div v-else-if="filter === 'all'" class="tbl-wrap">
        <table>
          <thead>
            <tr class="colhead">
              <th>Categoría / Producto</th>
              <th class="totcol">Total a producir</th>
              <th v-for="l in locals" :key="l.key">{{ l.label }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="c in visibleCategories" :key="c.name">
              <tr class="catrow" :class="c.cls">
                <td>{{ c.name }}</td>
                <td class="totcol">{{ catOrderedAll(c.products) }}</td>
                <td v-for="l in locals" :key="l.key">{{ catOrderedLocal(c.products, l.key) || '–' }}</td>
              </tr>
              <tr v-for="p in c.products" :key="p.name">
                <td class="name">{{ p.name }}</td>
                <td class="totcol">
                  <span class="pill" :class="{ ok: pendingAll(p) === 0 }">{{ orderedAll(p) }}</span>
                  <span v-if="sentAll(p) > orderedAll(p)" class="anom">+{{ sentAll(p) - orderedAll(p) }} de más</span>
                </td>
                <td v-for="l in locals" :key="l.key" class="num" :class="{ zero: !cellOf(p, l.key).ordered && !cellOf(p, l.key).sent }">
                  <template v-if="!cellOf(p, l.key).ordered && !cellOf(p, l.key).sent">–</template>
                  <template v-else-if="!cellOf(p, l.key).sent"><span class="pendnum">{{ cellOf(p, l.key).ordered }}</span></template>
                  <template v-else-if="cellOf(p, l.key).sent >= cellOf(p, l.key).ordered">
                    <span class="sentnum">✓ {{ cellOf(p, l.key).sent }}</span>
                    <span v-if="cellOf(p, l.key).sent > cellOf(p, l.key).ordered" class="anom">+{{ cellOf(p, l.key).sent - cellOf(p, l.key).ordered }} de más</span>
                  </template>
                  <template v-else><span class="partnum">{{ cellOf(p, l.key).sent }} de {{ cellOf(p, l.key).ordered }}</span></template>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- SAN MARINO / MALL DEL SOL: despacho de reposición -->
      <div v-else-if="current?.canSend" class="tbl-wrap">
        <table>
          <template v-for="c in visibleCategories" :key="c.name">
            <tbody>
              <tr><td colspan="6" class="catcell"><div class="cat" :class="c.cls"><span>{{ c.name }}</span><span class="tot">faltan {{ catPending(c.products) }}</span></div></td></tr>
              <tr class="subhead">
                <th>Producto</th><th>Pedido total</th><th>Clientes</th><th>Reposición</th><th>Enviado</th><th class="send-col">Enviar reposición</th>
              </tr>
              <tr v-for="p in c.products" :key="p.name" :class="{ sent: pendingOf(p, filter) === 0 }">
                <td class="name">{{ p.name }}</td>
                <td class="num">{{ cellOf(p, filter).ordered }}</td>
                <td class="num">
                  <span v-if="!cellOf(p, filter).clientOrdered" class="zero">–</span>
                  <span v-else-if="cellOf(p, filter).clientSent >= cellOf(p, filter).clientOrdered" class="sentnum">✓ {{ cellOf(p, filter).clientSent }}</span>
                  <button v-else type="button" class="link" @click="emit('go-orders')">{{ cellOf(p, filter).clientOrdered }} → Órdenes</button>
                </td>
                <td>
                  <span v-if="!cellOf(p, filter).restockOrdered" class="zero">–</span>
                  <span v-else-if="restockPendingOf(p, filter)" class="pill">{{ restockPendingOf(p, filter) }}</span>
                  <span v-else class="okb">✓ Enviado</span>
                </td>
                <td class="num" :class="{ zero: !cellOf(p, filter).restockSent }">
                  {{ cellOf(p, filter).restockSent || '–' }}
                  <span v-if="cellOf(p, filter).restockSent > cellOf(p, filter).restockOrdered" class="anom">+{{ cellOf(p, filter).restockSent - cellOf(p, filter).restockOrdered }} de más</span>
                  <span v-if="cellOf(p, filter).reception === 'wait'" class="rcv wait">Por confirmar</span>
                  <span v-else-if="cellOf(p, filter).reception === 'ok'" class="rcv ok">✓ Recibido</span>
                  <span v-else-if="cellOf(p, filter).reception === 'diff'" class="rcv diff">Llegó {{ cellOf(p, filter).receptionDiff > 0 ? '+' : '−' }}{{ Math.abs(cellOf(p, filter).receptionDiff) }}</span>
                </td>
                <td class="send-col">
                  <template v-if="cellOf(p, filter).restockOrdered || cellOf(p, filter).restockSent">
                    <div class="sendbox">
                      <div class="stepper" :class="{ over: afterSend(p) > 0 && draftOf(p) > 0 }">
                        <button type="button" aria-label="Menos" @click="setDraft(p, draftOf(p) - 1)">−</button>
                        <input
                          type="number"
                          inputmode="numeric"
                          min="0"
                          :value="draftOf(p)"
                          :aria-label="`Enviar ${p.name}`"
                          @input="setDraft(p, Number(($event.target as HTMLInputElement).value))"
                        />
                        <button type="button" aria-label="Más" @click="setDraft(p, draftOf(p) + 1)">+</button>
                      </div>
                      <button
                        type="button"
                        class="send"
                        :disabled="!draftOf(p) || !sendDate || !!sendingKey"
                        @click="send(p)"
                      >
                        <i v-if="sendingKey === `${filter}|||${p.name}`" class="fas fa-spinner fa-spin"></i>
                        <template v-else>Enviar</template>
                      </button>
                    </div>
                    <span v-if="draftOf(p) > 0 && afterSend(p) > 0" class="rownote">+{{ afterSend(p) }} de más de lo pedido</span>
                    <span v-else-if="draftOf(p) > 0 && afterSend(p) < 0" class="rownote partial">quedan {{ -afterSend(p) }} por enviar</span>
                  </template>
                  <span v-else class="rownote muted">Solo pedidos de clientes</span>
                </td>
              </tr>
            </tbody>
          </template>
        </table>
      </div>

      <!-- DELIVERY / CENTRO DE PRODUCCIÓN: solo lectura -->
      <div v-else class="tbl-wrap">
        <table>
          <template v-for="c in visibleCategories" :key="c.name">
            <tbody>
              <tr><td colspan="4" class="catcell"><div class="cat" :class="c.cls"><span>{{ c.name }}</span><span class="tot">faltan {{ catPending(c.products) }}</span></div></td></tr>
              <tr class="subhead"><th>Producto</th><th>Pedido</th><th>Enviado</th><th>Pendiente</th></tr>
              <tr v-for="p in c.products" :key="p.name" :class="{ sent: pendingOf(p, filter) === 0 }">
                <td class="name">{{ p.name }}</td>
                <td class="num">{{ cellOf(p, filter).ordered }}</td>
                <td class="num" :class="{ zero: !cellOf(p, filter).sent }">
                  {{ cellOf(p, filter).sent || '–' }}
                  <span v-if="cellOf(p, filter).sent > cellOf(p, filter).ordered" class="anom">+{{ cellOf(p, filter).sent - cellOf(p, filter).ordered }} de más</span>
                </td>
                <td>
                  <span v-if="pendingOf(p, filter)" class="pill">{{ pendingOf(p, filter) }}</span>
                  <span v-else class="okb">✓ Enviado</span>
                </td>
              </tr>
            </tbody>
          </template>
        </table>
      </div>
    </section>

    <p class="hint">
      <template v-if="filter === 'all'">Esta vista es solo para leer. Total a producir siempre muestra lo pedido. Para despachar, elige un local arriba.</template>
      <template v-else-if="current?.canSend">
        Enviar registra lo que sale del CDP hacia la reposición de {{ current.label }}. El local confirma lo que le llegó en Recepción de Pedidos.
        Los pedidos de clientes con retiro en este local se despachan en
        <button type="button" class="link" @click="emit('go-orders')">Órdenes</button>.
      </template>
      <template v-else>
        Para despachar, ve a <button type="button" class="link" @click="emit('go-orders')">Órdenes</button> y usa "Reportar envío" en cada pedido.
      </template>
    </p>
  </div>
</template>

<style lang="scss" scoped>
$brand: #812a73;
$brand-soft: #f6e9f3;
$line: #e2e8f0;
$muted: #94a3b8;
$soft: #64748b;
$ok: #16a34a;
$ok-soft: #dcfce7;
$warn: #ea580c;
$warn-soft: #fff7ed;
$over: #7e22ce;

.dispatch-board { margin-top: 0.5rem; }

.loc-label { font-size: 11px; font-weight: 800; letter-spacing: .06em; color: $soft; text-transform: uppercase; margin-bottom: 0.4rem; }

.locs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.loc {
  display: flex; gap: 10px; align-items: center; border: 1.5px solid $line; background: white; color: #1e293b;
  padding: 9px 14px; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 14px; text-align: left; font-family: inherit;
  small { display: block; font-size: 11px; color: $muted; font-weight: 600; text-transform: uppercase; }
  &.on { border-color: $brand; background: $brand-soft; color: $brand; }
  &:focus-visible { outline: 3px solid #c084fc; outline-offset: 2px; }
}
.ico { width: 30px; height: 30px; border-radius: 8px; background: #e0efff; color: #2b8fd6; display: grid; place-items: center; font-size: 14px; }

.board { border: 1px solid $line; border-radius: 14px; overflow: hidden; background: white; }
.board-head {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid $line;
  h2 { margin: 0; font-size: 17px; font-weight: 800; color: #1e293b; }
  p { margin: 2px 0 0; font-size: 12px; color: $muted; font-weight: 600; text-transform: uppercase; }
}
.progress { font-size: 12px; color: $soft; font-weight: 700; }
.date-warn { padding: 10px 16px; background: #fefce8; color: #854d0e; font-size: 13px; border-bottom: 1px solid #fde68a; }
.empty { padding: 2rem 1rem; text-align: center; color: $muted; }

.tbl-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; min-width: 560px; }
th { text-align: center; font-size: 10px; letter-spacing: .06em; color: $muted; padding: 6px 10px; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
th:first-child { text-align: left; padding-left: 18px; }
th.send-col, td.send-col { background: #fbf6fa; }
td { padding: 8px 10px; border-top: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; text-align: center; color: #1e293b; }
td.name { font-weight: 600; text-align: left; padding-left: 18px; }
td.num { color: $soft; }
td.num.zero, .zero { color: #cbd5e1; }
td.catcell { padding: 0; border-top: 0; }

.colhead th { position: sticky; top: 0; background: white; border-bottom: 1px solid $line; padding-block: 10px; z-index: 1; }
.colhead th.totcol { color: $warn; }
td.totcol { width: 130px; }
tr.catrow td { font-size: 12px; font-weight: 800; letter-spacing: .04em; padding-block: 8px; border-top: 1px solid $line; }
tr.catrow td:first-child { text-align: left; padding-left: 18px; }

.cat { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; font-size: 12px; font-weight: 800; letter-spacing: .04em; border-top: 1px solid $line; }
.cat .tot { background: rgba(0, 0, 0, .07); border-radius: 10px; padding: 2px 9px; font-size: 11px; }

@mixin cat-color($bg, $fg) { background: $bg; color: $fg; }
.c1 { &.cat, &.catrow td { @include cat-color(#ede9fe, #5b21b6); } }
.c2 { &.cat, &.catrow td { @include cat-color(#e0e7ff, #3730a3); } }
.c3 { &.cat, &.catrow td { @include cat-color(#fef3c7, #92400e); } }
.c4 { &.cat, &.catrow td { @include cat-color(#ccfbf1, #134e4a); } }
.c5 { &.cat, &.catrow td { @include cat-color(#ffedd5, #9a3412); } }
.c6 { &.cat, &.catrow td { @include cat-color(#fce7f3, #9d174d); } }
.c7 { &.cat, &.catrow td { @include cat-color(#dcfce7, #14532d); } }
.c8 { &.cat, &.catrow td { @include cat-color(#f1f5f9, #475569); } }

.pill { display: inline-block; min-width: 40px; text-align: center; font-weight: 800; padding: 3px 10px; border-radius: 999px; background: $warn-soft; color: $warn; }
.pill.ok { background: $ok-soft; color: $ok; }
.okb { display: inline-block; font-weight: 800; font-size: 12px; padding: 3px 10px; border-radius: 999px; background: $ok-soft; color: $ok; white-space: nowrap; }
.anom { display: inline-block; font-weight: 800; font-size: 11px; padding: 2px 7px; border-radius: 999px; margin-left: 4px; white-space: nowrap; background: #f3e8ff; color: $over; }
.pendnum { color: #1e293b; font-weight: 700; }
.sentnum { display: inline-block; font-weight: 800; color: $ok; background: $ok-soft; border-radius: 999px; padding: 2px 9px; }
.partnum { display: inline-block; font-weight: 800; color: #92400e; background: #fef3c7; border-radius: 999px; padding: 2px 9px; }
.rcv { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; white-space: nowrap; margin-left: 4px; }
.rcv.wait { background: #e0f2fe; color: #075985; }
.rcv.ok { background: $ok-soft; color: $ok; }
.rcv.diff { background: #fee2e2; color: #b91c1c; }

tr.sent td.name, tr.sent td.num { color: $muted; }
tr.sent td { background: #fafafa; }
tr.sent td.send-col { background: #f7f3f6; }

td.send-col { width: 230px; }
.sendbox { display: flex; gap: 6px; align-items: center; justify-content: center; }
.stepper {
  display: flex; align-items: center; border: 1.5px solid $line; border-radius: 10px; overflow: hidden; background: white;
  button { width: 34px; height: 34px; border: 0; background: #f8fafc; font-weight: 800; font-size: 17px; cursor: pointer; color: #1e293b; }
  input { width: 52px; border: 0; text-align: center; font-weight: 800; font-size: 15px; color: #1e293b; background: white; -moz-appearance: textfield; }
  input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  &.over { border-color: #a855f7; }
}
.send {
  border: 0; border-radius: 9px; padding: 0 14px; height: 37px; font-weight: 800; font-size: 13px; color: white; background: $brand; cursor: pointer; min-width: 70px;
  &:disabled { background: $line; color: $muted; cursor: not-allowed; }
}
.rownote { display: block; font-size: 11px; font-weight: 700; color: $over; margin-top: 3px; }
.rownote.partial { color: #92400e; }
.rownote.muted { color: $muted; }

.link { background: none; border: 0; color: $brand; font-weight: 700; font-size: 13px; cursor: pointer; text-decoration: underline; padding: 0; font-family: inherit; }
.hint { font-size: 12px; color: $soft; margin: 10px 0 0; }
</style>
