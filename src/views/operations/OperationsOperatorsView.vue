<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { productionHistoryService, type ProductionOperator, longDate, timeOf } from '@/services/production-history.service'

/** Lista de operarios de la tablet: solo el Jefe de Operaciones la cambia. */
const operators = ref<ProductionOperator[]>([])
const loading = ref(true)
const error = ref('')
const message = ref('')
const newName = ref('')
const saving = ref(false)
const confirmId = ref<string | null>(null)

const ecDate = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3600000).toISOString().slice(0, 10)

async function load() {
  loading.value = true
  error.value = ''
  try {
    operators.value = await productionHistoryService.listOperators()
  } catch (e: any) {
    error.value = e?.message || 'No se pudo cargar la lista.'
  } finally {
    loading.value = false
  }
}

async function add() {
  const name = newName.value.trim()
  if (!name || saving.value) return
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const res = await productionHistoryService.addOperator(name)
    message.value = res.message
    newName.value = ''
    await load()
  } catch (e: any) {
    error.value = e?.message || 'No se pudo agregar.'
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const res = await productionHistoryService.removeOperator(id)
    message.value = res.message
    confirmId.value = null
    await load()
  } catch (e: any) {
    error.value = e?.message || 'No se pudo borrar.'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="ph-page">
    <header class="top">
      <div class="ic"><i class="fa-solid fa-users"></i></div>
      <div class="tt">
        <h1>Operarios</h1>
        <p>Quién aparece en la tablet de producción. Solo el Jefe de Operaciones puede cambiar esta lista.</p>
      </div>
    </header>

    <p v-if="message" class="ok-msg">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section class="sec">
      <h2>Agregar operario</h2>
      <form class="form" @submit.prevent="add">
        <input id="new-operator" v-model="newName" maxlength="60" placeholder="Nombre, como lo verá en la tablet" aria-label="Nombre del operario" />
        <button class="btn" type="submit" :disabled="!newName.trim() || saving">＋ Agregar</button>
      </form>
    </section>

    <section class="sec">
      <h2>{{ operators.length }} operarios activos</h2>
      <p v-if="loading" class="muted">Cargando…</p>
      <div v-else>
        <div v-for="o in operators" :key="o.id" class="orow">
          <img v-if="o.photo" :src="o.photo" class="av" :alt="`Foto de ${o.name}`" />
          <span v-else class="av">{{ o.name.charAt(0).toUpperCase() }}</span>
          <div class="i">
            <b>{{ o.name }}</b>
            <span v-if="o.lastEntryAt" class="cap">Último ingreso: {{ longDate(ecDate(o.lastEntryAt)) }} · {{ timeOf(o.lastEntryAt) }}</span>
            <span v-else>Sin ingresos todavía</span>
          </div>
          <template v-if="confirmId === o.id">
            <span class="ask">¿Borrar a {{ o.name }}? Su historial se conserva.</span>
            <button class="btn danger" :disabled="saving" @click="remove(o.id)">Sí, borrar</button>
            <button class="btn ghost" @click="confirmId = null">Cancelar</button>
          </template>
          <button v-else class="btn del" @click="confirmId = o.id">Borrar</button>
        </div>
        <p v-if="!operators.length" class="muted">No hay operarios. Agrega el primero arriba.</p>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
@use './production-history.scss';

.form { display: flex; gap: 10px; flex-wrap: wrap;
  input { flex: 1 1 220px; font: inherit; font-size: 1rem; height: 46px; border: 1px solid #e8ecf2; border-radius: 12px; padding: 0 14px; }
}
.orow { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid #e8ecf2; flex-wrap: wrap;
  &:last-child { border-bottom: none; }
  .av { width: 40px; height: 40px; }
  .i { flex: 1; min-width: 140px;
    b { display: block; }
    span { font-size: .8rem; color: #64748b; }
  }
}
.cap { text-transform: capitalize; }
.ask { font-size: .85rem; color: #b91c1c; font-weight: 700; }
</style>
