<script setup lang="ts">
import { computed } from 'vue'

// Desglose de una orden para comprobar que cuadra antes (y después) de
// marcar enviado: lo pedido, lo que realmente se hizo y lo que ya salió.
const props = defineProps<{ order: any }>()

interface Line {
  name: string
  pedido: number
  hecho: number
  enviado: number
  cerrado: boolean // resto eliminado: se cerró produciendo menos
  estado: { label: string; class: string }
}

const sentByProduct = computed<Map<string, number>>(() => {
  const map = new Map<string, number>()
  for (const d of props.order.dispatches || []) {
    for (const item of d.items || []) {
      const key = String(item.name || '')
      map.set(key, (map.get(key) || 0) + (item.quantitySent || 0))
    }
  }
  return map
})

const lines = computed<Line[]>(() =>
  (props.order.products || []).map((p: any) => {
    const pedido = p.quantity || 0
    const hecho = p.produced || 0
    const enviado = sentByProduct.value.get(String(p.name)) || 0
    const cerrado = p.productionStatus === 'COMPLETED' && hecho < pedido

    // Lo exigible es lo que se hizo cuando la fila se cerró con menos.
    const exigible = cerrado ? hecho : pedido

    let estado = { label: 'Todo cuadra', class: 'ok' }
    if (hecho < pedido && !cerrado) {
      estado = { label: `Falta producir ${pedido - hecho}`, class: 'warn' }
    } else if (enviado < exigible) {
      estado = { label: `Falta enviar ${exigible - enviado}`, class: 'pending' }
    } else if (enviado > pedido) {
      estado = { label: `Se envió ${enviado - pedido} de más`, class: 'bad' }
    } else if (cerrado) {
      estado = { label: `Cerrado con ${pedido - hecho} menos`, class: 'closed' }
    }

    return { name: p.name, pedido, hecho, enviado, cerrado, estado }
  })
)

const totals = computed(() =>
  lines.value.reduce(
    (acc, l) => ({
      pedido: acc.pedido + l.pedido,
      hecho: acc.hecho + l.hecho,
      enviado: acc.enviado + l.enviado,
    }),
    { pedido: 0, hecho: 0, enviado: 0 }
  )
)

const veredicto = computed(() => {
  const faltaProducir = lines.value.filter(l => l.estado.class === 'warn').length
  const faltaEnviar = lines.value.filter(l => l.estado.class === 'pending').length
  const exceso = lines.value.filter(l => l.estado.class === 'bad').length
  if (exceso) return { label: 'Hay producto enviado de más', class: 'bad' }
  if (faltaProducir) return { label: `${faltaProducir} producto(s) sin terminar de producir`, class: 'warn' }
  if (faltaEnviar) return { label: `${faltaEnviar} producto(s) por enviar`, class: 'pending' }
  return { label: 'Todo cuadra: lo que se hizo ya salió', class: 'ok' }
})

const fmt = (d: string | Date) =>
  new Date(d).toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const receptionLabel = (status: string) =>
  status === 'RECEIVED' ? 'Recibido' : status === 'PROBLEM' ? 'Recibido con novedad' : 'Pendiente de recibir'
</script>

<template>
  <div class="breakdown">
    <!-- Qué se hizo, producto por producto -->
    <div class="lines">
      <div v-for="line in lines" :key="line.name" class="line" :class="line.estado.class">
        <span class="pname">{{ line.name }}</span>
        <span class="nums">
          <span class="num"><b>{{ line.pedido }}</b><i>pedido</i></span>
          <span class="num hecho"><b>{{ line.hecho }}</b><i>hecho</i></span>
          <span class="num enviado"><b>{{ line.enviado }}</b><i>enviado</i></span>
        </span>
        <span class="tag" :class="line.estado.class">{{ line.estado.label }}</span>
      </div>
    </div>

    <!-- Totales y veredicto -->
    <div class="totals">
      <span>Total: <b>{{ totals.pedido }}</b> pedido · <b>{{ totals.hecho }}</b> hecho · <b>{{ totals.enviado }}</b> enviado</span>
      <span class="verdict" :class="veredicto.class">{{ veredicto.label }}</span>
    </div>

    <!-- Envíos ya registrados -->
    <div v-if="(order.dispatches || []).length > 0" class="dispatches">
      <span class="dis-title">Envíos registrados</span>
      <div v-for="(d, i) in order.dispatches" :key="i" class="dis">
        <span class="dis-head">
          <i class="fas fa-truck"></i>
          <strong>{{ d.destination }}</strong>
          <span class="dis-when">{{ fmt(d.reportedAt) }}</span>
          <span class="dis-rec" :class="d.receptionStatus?.toLowerCase()">{{ receptionLabel(d.receptionStatus) }}</span>
        </span>
        <span class="dis-items">
          <span v-for="(it, j) in d.items || []" :key="j" class="dis-item">
            {{ it.name }} <b>x{{ it.quantitySent }}</b>
          </span>
        </span>
        <span v-if="d.reportedBy" class="dis-by">Reportó: {{ d.reportedBy }}</span>
      </div>
    </div>
    <div v-else class="no-dispatch">
      <i class="fas fa-circle-info"></i> Todavía no se ha reportado ningún envío.
    </div>
  </div>
</template>

<style lang="scss" scoped>
.breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.5rem 0 0.2rem;
}

.lines {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-left: 3px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;

  &.ok { border-left-color: #16a34a; }
  &.pending { border-left-color: #2563eb; background: #f5f9ff; }
  &.warn { border-left-color: #f59e0b; background: #fffbeb; }
  &.closed { border-left-color: #94a3b8; }
  &.bad { border-left-color: #dc2626; background: #fef2f2; }
}

.pname {
  flex: 1 1 130px;
  min-width: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: #1e293b;
}

.nums {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.num {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  padding: 1px 8px;
  min-width: 46px;

  b { font-size: 0.86rem; font-weight: 800; color: #0f172a; line-height: 1.2; }
  i { font-style: normal; font-size: 0.58rem; font-weight: 800; text-transform: uppercase; color: #94a3b8; }

  &.hecho b { color: #7c3aed; }
  &.enviado b { color: #2563eb; }
}

.tag {
  flex: 0 1 auto;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 2px 9px;
  border-radius: 20px;
  white-space: nowrap;

  &.ok { background: #dcfce7; color: #15803d; }
  &.pending { background: #dbeafe; color: #1d4ed8; }
  &.warn { background: #fef3c7; color: #92400e; }
  &.closed { background: #e2e8f0; color: #475569; }
  &.bad { background: #fee2e2; color: #b91c1c; }
}

.totals {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: #64748b;
  border-top: 1px dashed #e2e8f0;
  padding-top: 0.5rem;

  b { color: #0f172a; }
}

.verdict {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 20px;

  &.ok { background: #dcfce7; color: #15803d; }
  &.pending { background: #dbeafe; color: #1d4ed8; }
  &.warn { background: #fef3c7; color: #92400e; }
  &.bad { background: #fee2e2; color: #b91c1c; }
}

.dispatches {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dis-title {
  font-size: 0.66rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.dis {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
}

.dis-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  color: #334155;

  i { color: #2563eb; font-size: 0.72rem; }
  .dis-when { color: #94a3b8; font-size: 0.72rem; }
}

.dis-rec {
  font-size: 0.64rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 20px;
  background: #fef3c7;
  color: #92400e;

  &.received { background: #dbeafe; color: #1d4ed8; }
  &.problem { background: #fee2e2; color: #b91c1c; }
}

.dis-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.dis-item {
  font-size: 0.72rem;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 6px;
  padding: 1px 7px;

  b { color: #0f172a; }
}

.dis-by { font-size: 0.68rem; color: #94a3b8; }

.no-dispatch {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: #94a3b8;

  i { font-size: 0.7rem; }
}
</style>
