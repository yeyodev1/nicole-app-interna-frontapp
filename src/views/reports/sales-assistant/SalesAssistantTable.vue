<script setup lang="ts">
import type { MarkStatus, SalesGroup, SalesItem } from '@/services/sales-assistant.service'

const props = defineProps<{
  group: SalesGroup
  items: SalesItem[]
  busyKey: string | null
}>()

const emit = defineEmits<{
  copy: [item: SalesItem]
  mark: [item: SalesItem, mark: { read: boolean; status: MarkStatus }]
}>()

const ICON: Record<SalesGroup, { icon: string; color: string }> = {
  CALIENTE: { icon: 'fa-fire', color: '#c2410c' },
  TIBIO: { icon: 'fa-temperature-half', color: '#b7791f' },
  REBOTO: { icon: 'fa-rotate-left', color: '#7c3aed' },
  POSTVENTA: { icon: 'fa-receipt', color: '#0f766e' },
  TAREA: { icon: 'fa-list-check', color: '#1d4ed8' },
  FRIO: { icon: 'fa-snowflake', color: '#64748b' },
}

const WHY: Record<SalesGroup, string> = {
  CALIENTE: 'Por qué está caliente',
  TIBIO: 'Qué le frena',
  REBOTO: 'Dónde se fue',
  POSTVENTA: 'Qué falta',
  TAREA: 'Detalle',
  FRIO: 'Por qué está frío',
}
const isTask = () => props.group === 'TAREA' || props.group === 'POSTVENTA'

const read = (item: SalesItem) => !!item.mark?.read
const status = (item: SalesItem) => item.mark?.status ?? null

function toggleRead(item: SalesItem) {
  emit('mark', item, { read: !read(item), status: status(item) })
}

function toggleStatus(item: SalesItem, value: Exclude<MarkStatus, null>) {
  const next = status(item) === value ? null : value
  emit('mark', item, { read: next ? true : read(item), status: next })
}

const brandLabel = (marca: SalesItem['marca']) => (marca === 'sucree' ? 'Sucrée' : 'Nicole')
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Marca</th>
          <th v-if="isTask()">Tarea</th>
          <th v-else>Último mensaje</th>
          <th>{{ WHY[props.group] }}</th>
          <th v-if="!isTask()">Puntaje</th>
          <th>Mensaje propuesto</th>
          <th>Estado<span class="only">Solo para comerciales</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in props.items"
          :key="item.key"
          :class="{ done: status(item) === 'GESTIONADO', skipped: status(item) === 'NO_GESTIONAR' }"
        >
          <td>
            <div class="client"><i class="fa-solid" :class="ICON[item.group].icon" :style="{ color: ICON[item.group].color }"></i> {{ item.cliente }}</div>
            <span v-if="item.prioridad === 'ALTA'" class="prio"><i class="fa-solid fa-bolt"></i> Prioridad alta</span>
            <div class="meta">
              <span v-if="item.telefono">{{ item.telefono }}</span>
              <span v-if="item.recibido"> · {{ item.recibido }}</span>
            </div>
            <router-link v-if="item.orderId" :to="`/orders/${item.orderId}`" class="order-link">Ver pedido</router-link>
          </td>
          <td><span class="brand" :class="item.marca">{{ brandLabel(item.marca) }}</span></td>
          <td v-if="isTask()"><span class="task">{{ item.tarea }}</span></td>
          <td v-else class="quote">
            <span v-if="item.ultimoMensaje">“{{ item.ultimoMensaje }}”</span>
            <span v-if="item.ultimoMensajeDe === 'equipo'" class="meta"> (último mensaje del equipo)</span>
          </td>
          <td class="why">
            {{ item.motivo }}
            <div v-if="item.detalle" class="meta"><i class="fa-solid fa-tag"></i> {{ item.detalle }}</div>
            <div v-if="item.paso" class="meta"><i class="fa-solid fa-signs-post"></i> Paso: {{ item.paso }}</div>
            <div v-if="item.falta && props.group !== 'POSTVENTA'" class="meta"><i class="fa-solid fa-circle-exclamation"></i> Falta: {{ item.falta }}</div>
            <div v-for="(s, i) in item.senales || []" :key="i" class="meta signal">“{{ s }}”</div>
          </td>
          <td v-if="!isTask()" class="score" :class="props.group.toLowerCase()">{{ item.puntaje ?? '—' }}</td>
          <td>
            <div class="message">{{ item.mensaje }}</div>
            <button v-if="item.mensaje" type="button" class="copy" @click="emit('copy', item)">
              <i class="fa-regular fa-copy"></i> Copiar mensaje
            </button>
            <div v-if="item.seguimiento" class="meta"><i class="fa-regular fa-clock"></i> {{ item.seguimiento }}</div>
          </td>
          <td class="status-cell">
            <label>
              <input type="checkbox" :checked="read(item)" :disabled="props.busyKey === item.key" @change="toggleRead(item)" />
              <i class="fa-solid fa-eye" style="color: #475569"></i> Leído
            </label>
            <label>
              <input
                type="checkbox"
                :checked="status(item) === 'GESTIONADO'"
                :disabled="props.busyKey === item.key"
                @change="toggleStatus(item, 'GESTIONADO')"
              />
              <i class="fa-solid fa-circle-check" style="color: #15803d"></i> Gestionado
            </label>
            <label>
              <input
                type="checkbox"
                :checked="status(item) === 'NO_GESTIONAR'"
                :disabled="props.busyKey === item.key"
                @change="toggleStatus(item, 'NO_GESTIONAR')"
              />
              <i class="fa-solid fa-ban" style="color: #b91c1c"></i> No se gestiona a propósito
            </label>
            <div v-if="item.mark?.by" class="meta">{{ item.mark.by }}</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="scss" scoped>
.table-wrap {
  overflow-x: auto;
  border: 1px solid #ece7ef;
  border-radius: 12px;
  background: white;
}

table {
  width: 100%;
  min-width: 1080px;
  border-collapse: collapse;
  font-size: 0.85rem;
}

th {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #ece7ef;
  background: #faf8fb;
  color: #6b6475;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: left;
  text-transform: uppercase;

  .only {
    display: block;
    font-size: 0.6rem;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }
}

td {
  padding: 0.75rem;
  border-bottom: 1px solid #ece7ef;
  color: #1e1b24;
  vertical-align: top;
}

tr:last-child td { border-bottom: none; }
tr.done td { background: #f0faf3; }
tr.skipped td:not(.status-cell) { opacity: 0.45; }

.client { font-weight: 600; }
.meta { color: #6b6475; font-size: 0.75rem; }
.order-link { color: $NICOLE-PURPLE; font-size: 0.75rem; font-weight: 600; }

.brand {
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;

  &.nicole { background: $NICOLE-PURPLE; }
  &.sucree { background: #b7791f; }
}

.task {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: #eef3ff;
  color: #1d4ed8;
  font-size: 0.72rem;
  font-weight: 600;
}

.quote { max-width: 220px; color: #6b6475; font-style: italic; }
.why { max-width: 220px; }

.score {
  font-weight: 700;
  font-variant-numeric: tabular-nums;

  &.caliente { color: #c2410c; }
  &.tibio { color: #b7791f; }
}

.message {
  max-width: 330px;
  padding: 0.5rem 0.65rem;
  border: 1px solid #ece7ef;
  border-radius: 8px;
  background: #faf8fb;
  line-height: 1.45;
  white-space: pre-wrap;
}

.copy {
  margin-top: 0.4rem;
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: $NICOLE-PURPLE;
  color: white;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;

  &:hover { background: $purple-hover; }
  &:focus-visible { outline: 2px solid $NICOLE-PURPLE; outline-offset: 2px; }
}

.status-cell {
  min-width: 170px;

  label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-bottom: 0.35rem;
    font-size: 0.8rem;
    white-space: nowrap;
    cursor: pointer;
  }

  input {
    width: 16px;
    height: 16px;
    accent-color: $NICOLE-PURPLE;
    cursor: pointer;
  }
}
.prio {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 0.75rem;
  font-weight: 600;
}
.signal {
  font-style: italic;
}
</style>
