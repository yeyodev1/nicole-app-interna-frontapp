<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'

/**
 * Envío masivo de reposición a un local (Resumen de Producción).
 * Lista lo pendiente de reposición del local; cada cantidad arranca en 0 (o en lo escrito en la tabla)
 * y el operario pone lo que realmente sale. Cada producto se puede quitar. "Aprobar y enviar todo" emite un solo envío.
 * No incluye pedidos de clientes: esos se despachan uno por uno en Órdenes.
 */
export interface BulkRow {
  key: string       // misma clave que la casilla de la tabla (local|||producto)
  name: string
  category: string
  pending: number   // reposición pendiente (pedido − ya enviado)
  initial: number   // lo escrito en la casilla de la tabla
}

const props = defineProps<{
  open: boolean
  localLabel: string
  /** Día (YYYY-MM-DD) al que se registra el envío. */
  sendDate: string | null
  rows: BulkRow[]
  sending: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', items: { key: string; name: string; quantity: number }[]): void
}>()

const qty = ref<Record<string, number>>({})
const picked = ref<Record<string, boolean>>({})

// Al abrir: cantidades = lo escrito en la tabla (0 si no se escribió nada); todo marcado.
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  qty.value = Object.fromEntries(props.rows.map(r => [r.key, r.initial]))
  picked.value = Object.fromEntries(props.rows.map(r => [r.key, true]))
}, { immediate: true })

const qtyOf = (r: BulkRow) => qty.value[r.key] ?? r.initial
const setQty = (r: BulkRow, v: number) => { qty.value[r.key] = Math.max(0, Math.round(Number(v) || 0)) }
const isOn = (r: BulkRow) => picked.value[r.key] !== false

const groups = computed(() => {
  const out: { category: string; rows: BulkRow[] }[] = []
  for (const r of props.rows) {
    const last = out[out.length - 1]
    if (last && last.category === r.category) last.rows.push(r)
    else out.push({ category: r.category, rows: [r] })
  }
  return out
})

const chosen = computed(() => props.rows.filter(r => isOn(r) && qtyOf(r) > 0))
const totalUnits = computed(() => chosen.value.reduce((s, r) => s + qtyOf(r), 0))

const noteOf = (r: BulkRow): { text: string; cls: string } => {
  const q = qtyOf(r)
  const d = q - r.pending
  if (q === 0) return { text: 'no se envía', cls: 'muted' }
  if (d > 0) return { text: `+${d} de más`, cls: 'warn' }
  if (d < 0) return { text: `${-d} menos · quedan ${-d}`, cls: 'warn' }
  return { text: '✓ completo', cls: 'ok' }
}

const dateLabel = computed(() => {
  if (!props.sendDate) return ''
  return new Date(props.sendDate + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: '2-digit' })
})

const confirm = () => {
  if (props.sending || !chosen.value.length) return
  emit('confirm', chosen.value.map(r => ({ key: r.key, name: r.name, quantity: qtyOf(r) })))
}
const close = () => { if (!props.sending) emit('close') }

const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && props.open) close() }
watch(() => props.open, (isOpen) => {
  if (isOpen) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
}, { immediate: true })
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="open" class="bd-overlay" @click.self="close">
    <div class="bd-modal" role="dialog" aria-modal="true" aria-labelledby="bd-title">
      <div class="bd-head">
        <h3 id="bd-title">Envío masivo · {{ localLabel }}</h3>
        <p>
          Revisa lo que sale del Centro de producción para la reposición del <b>{{ dateLabel }}</b>.
          Escribe lo que realmente sale de cada producto: lo que quede en 0 no se envía.
        </p>
      </div>

      <div class="bd-body">
        <p v-if="!rows.length" class="bd-empty">No hay reposición pendiente para este local.</p>
        <template v-for="g in groups" :key="g.category">
          <div class="bd-cat">{{ g.category }}</div>
          <div v-for="r in g.rows" :key="r.key" class="bd-row" :class="{ off: !isOn(r) || qtyOf(r) === 0 }">
            <input
              :id="`bd-chk-${r.key}`"
              v-model="picked[r.key]"
              type="checkbox"
              :disabled="sending"
              :aria-label="`Incluir ${r.name}`"
            />
            <label class="bd-name" :for="`bd-chk-${r.key}`">
              {{ r.name }}
              <span class="bd-meta">
                <span class="bd-ped">Pedido <b>{{ r.pending }}</b></span>
                <span class="bd-note" :class="noteOf(r).cls">{{ noteOf(r).text }}</span>
              </span>
            </label>
            <div class="bd-stepper">
              <button type="button" aria-label="Menos" :disabled="!isOn(r) || sending" @click="setQty(r, qtyOf(r) - 1)">−</button>
              <input
                type="number"
                inputmode="numeric"
                min="0"
                :value="qtyOf(r)"
                :disabled="!isOn(r) || sending"
                :aria-label="`Cantidad a enviar de ${r.name}`"
                @input="setQty(r, Number(($event.target as HTMLInputElement).value))"
              />
              <button type="button" aria-label="Más" :disabled="!isOn(r) || sending" @click="setQty(r, qtyOf(r) + 1)">+</button>
            </div>
          </div>
        </template>
      </div>

      <div class="bd-foot">
        <div class="bd-sum"><b>{{ chosen.length }}</b> productos · <b>{{ totalUnits }}</b> unidades</div>
        <div class="bd-actions">
          <button type="button" class="bd-cancel" :disabled="sending" @click="close">Cancelar</button>
          <button type="button" class="bd-ok" :disabled="sending || !chosen.length" @click="confirm">
            <i v-if="sending" class="fas fa-spinner fa-spin"></i>
            <template v-else>Aprobar y enviar todo</template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$brand: #812a73;
$brand-soft: #f6e9f3;
$brand-line: #d8b4d0;
$line: #e2e8f0;
$muted: #94a3b8;
$soft: #64748b;
$ok: #16a34a;
$warn: #ea580c;

.bd-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, .45); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 1000; }
.bd-modal { background: white; border-radius: 14px; width: min(640px, 100%); max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(15, 23, 42, .25); }
.bd-head {
  padding: 18px 20px 12px; border-bottom: 1px solid $line;
  h3 { margin: 0; font-size: 18px; font-weight: 800; color: #1e293b; }
  p { margin: 4px 0 0; font-size: 13px; color: $soft; }
}
.bd-body { overflow-y: auto; padding: 4px 20px; }
.bd-empty { padding: 16px 0; color: $muted; }
.bd-cat { font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: $muted; padding: 12px 0 4px; }
.bd-row {
  display: grid; grid-template-columns: 22px 1fr auto; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9;
  input[type='checkbox'] { width: 18px; height: 18px; accent-color: $brand; cursor: pointer; }
  &.off .bd-name { opacity: .45; }
}
.bd-name { display: flex; flex-direction: column; gap: 3px; font-weight: 700; color: #1e293b; cursor: pointer; min-width: 0; }
.bd-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; }
.bd-ped { background: $brand-soft; color: $brand; border: 1px solid $brand-line; border-radius: 6px; padding: 1px 8px; b { font-size: 14px; } }
.bd-note { color: $muted; &.warn { color: $warn; } &.ok { color: $ok; } }
.bd-stepper {
  display: flex; align-items: center; border: 1.5px solid $line; border-radius: 10px; overflow: hidden; background: white;
  button { width: 34px; height: 34px; border: 0; background: #f8fafc; font-weight: 800; font-size: 17px; cursor: pointer; color: #1e293b; }
  button:disabled { cursor: not-allowed; color: #cbd5e1; }
  input { width: 56px; border: 0; text-align: center; font-weight: 800; font-size: 15px; color: #1e293b; background: white; -moz-appearance: textfield; }
  input:disabled { color: $muted; }
  input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
}
.bd-foot { padding: 14px 20px; border-top: 1px solid $line; display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; }
.bd-sum { font-size: 13px; color: $soft; b { font-size: 16px; color: #1e293b; } }
.bd-actions { display: flex; gap: 8px; }
.bd-cancel { border: 1.5px solid $line; background: white; color: #1e293b; border-radius: 9px; padding: 0 16px; height: 38px; font-weight: 700; cursor: pointer; font-family: inherit; }
.bd-ok {
  border: 0; border-radius: 9px; padding: 0 16px; height: 38px; font-weight: 800; color: white; background: $brand; cursor: pointer; min-width: 170px; font-family: inherit;
  &:disabled { background: $line; color: $muted; cursor: not-allowed; }
}
@media (max-width: 520px) {
  .bd-row { grid-template-columns: 22px 1fr; }
  .bd-stepper { grid-column: 2; justify-self: start; }
}
</style>
