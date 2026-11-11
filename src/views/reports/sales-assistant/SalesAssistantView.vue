<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SalesAssistantTable from './SalesAssistantTable.vue'
import salesAssistantService from '@/services/sales-assistant.service'
import type { MarkStatus, SalesAnalysis, SalesAnalysisSummary, SalesGroup, SalesItem } from '@/services/sales-assistant.service'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const analysis = ref<SalesAnalysis | null>(null)
const history = ref<SalesAnalysisSummary[]>([])
const selectedId = ref('')
const aiConfigured = ref(true)
const runningBy = ref<string | null>(null)
const isLoading = ref(false)
const isAnalyzing = ref(false)
const loadFailed = ref(false)
const busyKey = ref<string | null>(null)
const brand = ref<'todas' | 'nicole' | 'sucree'>('todas')

const SECTIONS: { group: SalesGroup; title: string; hint: string; color: string }[] = [
  { group: 'CALIENTE', title: '🔥 Clientes calientes', hint: 'Ya decidieron, solo falta confirmar o pagar', color: '#c2410c' },
  { group: 'TIBIO', title: '🥱 Clientes tibios', hint: 'Mostraron interés pero no han decidido', color: '#b7791f' },
  { group: 'TAREA', title: '🚨 Tareas pendientes', hint: 'Clientes de los que esperamos algo', color: '#1d4ed8' }
]

const visibleItems = computed(() =>
  (analysis.value?.items || []).filter((i) => brand.value === 'todas' || i.marca === brand.value)
)
const byGroup = (group: SalesGroup) => visibleItems.value.filter((i) => i.group === group)
const pendingCount = (group: SalesGroup) => byGroup(group).filter((i) => !i.mark?.status).length

const ecFormat = new Intl.DateTimeFormat('es-EC', {
  timeZone: 'America/Guayaquil',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
})
const fmt = (iso?: string) => (iso ? ecFormat.format(new Date(iso)) : '')
const isLatest = computed(() => !selectedId.value || selectedId.value === history.value[0]?._id)

async function loadHistory() {
  try {
    history.value = await salesAssistantService.history()
  } catch {
    history.value = []
  }
}

async function loadLatest() {
  isLoading.value = true
  loadFailed.value = false
  try {
    const data = await salesAssistantService.latest()
    analysis.value = data.analysis
    aiConfigured.value = data.aiConfigured
    runningBy.value = data.running ? data.running.by?.name || 'Alguien' : null
    selectedId.value = data.analysis?._id || ''
  } catch {
    loadFailed.value = true
  } finally {
    isLoading.value = false
  }
}

async function selectAnalysis(id: string) {
  if (!id) return
  isLoading.value = true
  try {
    const data = await salesAssistantService.byId(id)
    analysis.value = data.analysis
  } catch {
    toast.error('No se pudo abrir ese análisis.')
  } finally {
    isLoading.value = false
  }
}

async function analyzeNow() {
  isAnalyzing.value = true
  try {
    const data = await salesAssistantService.analyze()
    analysis.value = data.analysis
    selectedId.value = data.analysis?._id || ''
    runningBy.value = null
    toast.success('Análisis listo.')
    loadHistory()
  } catch (e: any) {
    toast.error(e?.response?.data?.message || e?.message || 'No se pudo completar el análisis.', 6000)
  } finally {
    isAnalyzing.value = false
  }
}

async function copyMessage(item: SalesItem) {
  try {
    await navigator.clipboard.writeText(item.mensaje)
    toast.success('Mensaje copiado. Pégalo en WhatsApp.')
  } catch {
    toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.')
  }
}

async function setMark(item: SalesItem, mark: { read: boolean; status: MarkStatus }) {
  const previous = item.mark
  item.mark = { ...(previous || {}), read: mark.status ? true : mark.read, status: mark.status }
  busyKey.value = item.key
  try {
    item.mark = await salesAssistantService.setMark(item.key, mark)
  } catch {
    item.mark = previous
    toast.error('No se pudo guardar la casilla.')
  } finally {
    busyKey.value = null
  }
}

onMounted(() => {
  loadLatest()
  loadHistory()
})
</script>

<template>
  <main class="assistant">
    <header class="top">
      <div>
        <h1>Asistente de ventas</h1>
        <p v-if="analysis">
          Conversaciones desde <b>{{ fmt(analysis.from) }}</b> hasta <b>{{ fmt(analysis.to) }}</b>
          · {{ analysis.conversationsRead }} conversaciones leídas
        </p>
        <p v-else-if="!isLoading">Pulsa “Analizar ahora” para leer las conversaciones desde ayer a las 17:00.</p>
      </div>
      <div class="actions">
        <div class="seg" role="group" aria-label="Marca">
          <button type="button" :class="{ on: brand === 'nicole' }" @click="brand = 'nicole'">Nicole</button>
          <button type="button" :class="{ on: brand === 'sucree' }" @click="brand = 'sucree'">Sucrée</button>
          <button type="button" :class="{ on: brand === 'todas' }" @click="brand = 'todas'">Todos</button>
        </div>
        <span v-if="analysis" class="last">
          Último análisis: <b>{{ fmt(analysis.createdAt) }}</b> · por {{ analysis.by?.name }}
        </span>
        <button type="button" class="primary" :disabled="isAnalyzing || !aiConfigured" @click="analyzeNow">
          <i class="fa-solid" :class="isAnalyzing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'"></i>
          {{ isAnalyzing ? 'Analizando… (hasta 1 min)' : 'Analizar ahora' }}
        </button>
      </div>
    </header>

    <div v-if="!aiConfigured" class="notice error" role="alert">
      Falta configurar la IA en el servidor (ANTHROPIC_API_KEY). Avísale a Diego.
    </div>
    <div v-if="runningBy && !isAnalyzing" class="notice">{{ runningBy }} está corriendo un análisis. Actualiza en un momento.</div>
    <div v-if="loadFailed" class="notice error" role="alert">
      <span>No se pudo cargar el asistente.</span>
      <button type="button" class="link" @click="loadLatest">Reintentar</button>
    </div>

    <div v-if="history.length > 1" class="history">
      <label for="sa-history">Historial</label>
      <select id="sa-history" v-model="selectedId" @change="selectAnalysis(selectedId)">
        <option v-for="h in history" :key="h._id" :value="h._id">
          {{ fmt(h.createdAt) }} · {{ h.by?.name }} · 🔥{{ h.counts.CALIENTE || 0 }} 🥱{{ h.counts.TIBIO || 0 }} 🚨{{ h.counts.TAREA || 0 }}
        </option>
      </select>
      <span v-if="!isLatest" class="meta">Estás viendo un análisis anterior.</span>
    </div>

    <ul v-if="analysis?.warnings?.length" class="warnings">
      <li v-for="(w, i) in analysis.warnings" :key="i">{{ w }}</li>
    </ul>

    <div v-if="isLoading && !analysis" class="empty">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <p>Cargando…</p>
    </div>

    <template v-else-if="analysis">
      <div class="stats">
        <div v-for="s in SECTIONS" :key="s.group" class="stat">
          <small>{{ s.title }}</small>
          <b :style="{ color: s.color }">{{ byGroup(s.group).length }}</b>
          <small>{{ pendingCount(s.group) }} sin gestionar</small>
        </div>
      </div>

      <section v-for="s in SECTIONS" :key="s.group" class="section">
        <div class="section-head">
          <h2>{{ s.title }}</h2>
          <p>{{ s.hint }}</p>
        </div>
        <SalesAssistantTable
          v-if="byGroup(s.group).length"
          :group="s.group"
          :items="byGroup(s.group)"
          :busy-key="busyKey"
          @copy="copyMessage"
          @mark="setMark"
        />
        <p v-else class="none">Nada en este grupo.</p>
      </section>
    </template>

    <div v-else-if="!loadFailed" class="empty">
      <i class="fa-regular fa-comments"></i>
      <p>Todavía no hay análisis. Pulsa “Analizar ahora”.</p>
    </div>
  </main>
</template>

<style lang="scss" scoped>
.assistant {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 1rem;
  background: white;
  text-align: left;

  @media (min-width: 768px) { padding: 1.5rem; }
  @media (min-width: 1024px) { padding: 2rem; }
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #ece7ef;

  h1 {
    margin: 0;
    color: $NICOLE-PURPLE;
    font-family: $font-principal;
    font-size: 1.6rem;
    font-weight: 500;
  }

  p {
    margin: 0.25rem 0 0;
    color: #6b6475;
    font-size: 0.86rem;
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.seg {
  display: flex;
  overflow: hidden;
  border: 1px solid #ece7ef;
  border-radius: 8px;

  button {
    padding: 0.45rem 0.8rem;
    border: none;
    background: white;
    color: #6b6475;
    font-size: 0.8rem;
    cursor: pointer;

    &.on {
      background: #f6e9f1;
      color: $NICOLE-PURPLE;
      font-weight: 600;
    }
  }
}

.last {
  padding: 0.45rem 0.7rem;
  border: 1px solid #ece7ef;
  border-radius: 8px;
  background: #faf8fb;
  color: #6b6475;
  font-size: 0.8rem;

  b { color: $NICOLE-PURPLE; }
}

.primary {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1rem;
  border: none;
  border-radius: 8px;
  background: $NICOLE-PURPLE;
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) { background: $purple-hover; }
  &:focus-visible { outline: 2px solid $NICOLE-PURPLE; outline-offset: 2px; }
  &:disabled { opacity: 0.6; cursor: wait; }
}

.history {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;

  label { color: #6b6475; font-weight: 600; }
  select {
    padding: 0.4rem 0.6rem;
    border: 1px solid #ece7ef;
    border-radius: 8px;
    background: white;
  }
}

.meta { color: #6b6475; font-size: 0.8rem; }

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 640px) { grid-template-columns: minmax(0, 1fr); }
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid #ece7ef;
  border-radius: 10px;

  small { color: #6b6475; font-size: 0.78rem; }
  b { font-size: 1.6rem; font-variant-numeric: tabular-nums; }
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.6rem;

  h2 { margin: 0; color: #1e1b24; font-size: 1.05rem; }
  p { margin: 0; color: #6b6475; font-size: 0.82rem; }
}

.none { margin: 0; color: #9a92a3; font-size: 0.85rem; }

.notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid #ece7ef;
  border-radius: 10px;
  background: #f7f4f9;
  color: #4b4453;
  font-size: 0.85rem;

  &.error {
    border-color: #fecaca;
    background: #fef2f2;
    color: #b91c1c;
  }
}

.warnings {
  margin: 0;
  padding: 0.65rem 0.85rem 0.65rem 1.8rem;
  border: 1px solid #f1e3a6;
  border-radius: 10px;
  background: #fffbe6;
  color: #7a5b00;
  font-size: 0.82rem;
}

.link {
  padding: 0.25rem 0;
  border: none;
  background: none;
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 2.5rem 1.25rem;
  border: 1px dashed #ddd6e3;
  border-radius: 16px;
  color: #6b6475;

  i { color: #9a92a3; font-size: 1.4rem; }
  p { margin: 0; font-size: 0.92rem; }
}
</style>
