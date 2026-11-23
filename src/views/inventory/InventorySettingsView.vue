<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  inventoryService,
  type InventoryCatalog,
  type InventoryCompany,
  type InventoryProductBlock,
} from '@/services/inventory.service'

/**
 * Ajustes generales (solo el Jefe de Operaciones): el catálogo general de productos por empresa.
 * "Producto terminado" es la lista de la toma de inventario y también la del Ingreso de producción
 * (tablet); sus códigos deben existir en Contífico (el servidor lo revisa al guardar).
 * Los cambios se guardan con "Guardar cambios". Lo que ya se contó o se ingresó no cambia.
 */

const BLOCK_KEYS: InventoryProductBlock[] = ['pt', 'pp', 'mp']
const DEFAULT_UNIT: Record<InventoryProductBlock, string> = { pt: 'unid.', pp: 'kg', mp: 'kg' }

const company = ref<InventoryCompany>('nicole')
const blockKey = ref<InventoryProductBlock>('pt')
const catalog = ref<InventoryCatalog | null>(null)
const original = ref('')
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveMsg = ref('')
const saveError = ref('')

const newCategory = ref('')
const newUnit = ref('')
const newProduct = ref<Record<number, string>>({})

const dirty = computed(() => !!catalog.value && JSON.stringify(catalog.value) !== original.value)
const block = computed(() => catalog.value?.blocks.find(b => b.key === blockKey.value))

async function load() {
  loading.value = true
  loadError.value = ''
  saveMsg.value = ''
  try {
    catalog.value = await inventoryService.getCatalog(company.value)
    original.value = JSON.stringify(catalog.value)
  } catch (e: any) {
    loadError.value = e?.message || 'No se pudieron cargar los ajustes.'
  } finally {
    loading.value = false
  }
}

// Cambiar de empresa con cambios sin guardar pide confirmar dentro de la página.
const pendingCompany = ref<InventoryCompany | null>(null)
function changeCompany(c: InventoryCompany) {
  if (c === company.value) return
  if (dirty.value) {
    pendingCompany.value = c
    return
  }
  company.value = c
}
async function saveAndSwitch() {
  const c = pendingCompany.value
  await save()
  if (saveError.value || !c) return
  pendingCompany.value = null
  company.value = c
}
function discardAndSwitch() {
  const c = pendingCompany.value
  pendingCompany.value = null
  if (c) company.value = c
}
watch(company, load)

function nextCode(): string {
  const prefix = `${blockKey.value.toUpperCase()}-`
  let max = 0
  for (const c of block.value?.categories || [])
    for (const p of c.products) {
      const m = p.code.match(/(\d+)$/)
      if (p.code.toUpperCase().startsWith(prefix) && m) max = Math.max(max, Number(m[1]))
    }
  return prefix + String(max + 1).padStart(3, '0')
}

function addCategory() {
  const name = newCategory.value.trim()
  if (!name || !block.value) return
  if (block.value.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    saveError.value = `Ya existe la categoría "${name}".`
    return
  }
  block.value.categories.push({ name, products: [] })
  newCategory.value = ''
  saveError.value = ''
}

function renameCategory(ci: number, ev: Event) {
  const input = ev.target as HTMLInputElement
  const name = input.value.trim()
  const cats = block.value!.categories
  if (!name || cats.some((c, i) => i !== ci && c.name.toLowerCase() === name.toLowerCase())) {
    input.value = cats[ci]!.name
    return
  }
  cats[ci]!.name = name
}

function removeCategory(ci: number) {
  block.value!.categories.splice(ci, 1)
}

function addProduct(ci: number) {
  const name = (newProduct.value[ci] || '').trim()
  if (!name) return
  block.value!.categories[ci]!.products.push({ code: nextCode(), name, unit: DEFAULT_UNIT[blockKey.value] })
  newProduct.value[ci] = ''
}

function renameProduct(ci: number, pi: number, field: 'name' | 'code', ev: Event) {
  const input = ev.target as HTMLInputElement
  const v = input.value.trim()
  const p = block.value!.categories[ci]!.products[pi]!
  if (!v) {
    input.value = p[field]
    return
  }
  p[field] = v
}

function removeProduct(ci: number, pi: number) {
  block.value!.categories[ci]!.products.splice(pi, 1)
}

function addUnit() {
  const u = newUnit.value.trim()
  if (!u || !catalog.value) return
  if (!catalog.value.units.some(x => x.toLowerCase() === u.toLowerCase())) catalog.value.units.push(u)
  newUnit.value = ''
}

function removeUnit(i: number) {
  const units = catalog.value!.units
  if (units.length < 2) return
  const [gone] = units.splice(i, 1)
  // Los productos que usaban esa unidad pasan a la primera de la lista
  for (const b of catalog.value!.blocks)
    for (const c of b.categories) for (const p of c.products) if (p.unit === gone) p.unit = units[0]!
}

async function save() {
  if (!catalog.value) return
  saving.value = true
  saveError.value = ''
  saveMsg.value = ''
  try {
    const { catalog: saved, aviso } = await inventoryService.saveCatalog({
      company: company.value,
      blocks: catalog.value.blocks,
      units: catalog.value.units,
    })
    catalog.value = saved
    original.value = JSON.stringify(catalog.value)
    saveMsg.value = aviso ? `✓ Cambios guardados. ${aviso}` : '✓ Cambios guardados'
  } catch (e: any) {
    saveError.value = e?.message || 'No se pudieron guardar los cambios.'
  } finally {
    saving.value = false
  }
}

onBeforeRouteLeave(() => {
  if (dirty.value && !saving.value) save()
})

onMounted(load)
</script>

<template>
  <div class="inv-page">
    <header class="inv-head">
      <div class="ic"><i class="fa-solid fa-gear"></i></div>
      <div class="ht"><h1>Ajustes generales</h1></div>
    </header>
    <p class="sub">Aquí se arma la lista general de productos de cada empresa: bloques, categorías, productos y unidades. Lo que agregues en <b>Producto terminado</b> aparece en la <b>toma de inventario</b> y en el <b>Ingreso de producción</b>. Lo que ya se contó o se ingresó no cambia.</p>

    <div class="field">
      <span class="lab">Empresa</span>
      <div class="seg">
        <button :class="{ sel: company === 'nicole' }" @click="changeCompany('nicole')">Nicole</button>
        <button :class="{ sel: company === 'sucree' }" @click="changeCompany('sucree')">Sucrée</button>
      </div>
    </div>
    <div v-if="pendingCompany" class="error">
      Tienes cambios sin guardar.
      <button class="btn sm" @click="saveAndSwitch">Guardar y cambiar</button>
      <button class="btn sm ghost" @click="discardAndSwitch">Descartar</button>
    </div>

    <div v-if="loading" class="panel muted">Cargando…</div>
    <div v-else-if="loadError" class="panel">
      <p class="error">{{ loadError }}</p>
      <div><button class="btn" @click="load">Reintentar</button></div>
    </div>

    <template v-else-if="catalog && block">
      <section class="panel">
        <h2>Productos</h2>
        <div class="seg">
          <button v-for="k in BLOCK_KEYS" :key="k" :class="{ sel: blockKey === k }" @click="blockKey = k">
            {{ catalog.blocks.find(b => b.key === k)?.title }}
          </button>
        </div>

        <div class="field">
          <label for="aj-title">Nombre del bloque</label>
          <input id="aj-title" v-model.trim="block.title" class="aj-in strong" style="max-width: 360px" maxlength="60" />
        </div>

        <p v-if="blockKey === 'pt'" class="sub">
          Esta lista es la del Ingreso de producción y la de la toma de inventario. Crea primero el producto en
          Contífico y copia aquí su código tal cual: al guardar se revisa que exista en Contífico.
        </p>

        <div class="field">
          <span class="lab">Categorías y productos · nombre, código y unidad</span>
          <div class="ajcats">
            <div v-for="(c, ci) in block.categories" :key="`${blockKey}-${ci}`" class="ajcat">
              <div class="ajcat-h">
                <input
                  :id="`aj-cat-${blockKey}-${ci}`"
                  class="aj-in strong"
                  :value="c.name"
                  maxlength="80"
                  aria-label="Nombre de la categoría"
                  @change="renameCategory(ci, $event)"
                />
                <span class="old">{{ c.products.length }} productos</span>
                <button
                  class="rm"
                  :disabled="c.products.length > 0"
                  :title="c.products.length ? 'Primero quita sus productos' : 'Borrar categoría'"
                  :aria-label="`Borrar categoría ${c.name}`"
                  @click="removeCategory(ci)"
                >✕</button>
              </div>
              <div v-for="(p, pi) in c.products" :key="`${p.code}-${pi}`" class="ajrow">
                <input :id="`aj-pn-${blockKey}-${ci}-${pi}`" class="aj-in" :value="p.name" maxlength="80" aria-label="Nombre del producto" @change="renameProduct(ci, pi, 'name', $event)" />
                <input :id="`aj-pc-${blockKey}-${ci}-${pi}`" class="aj-in code" :value="p.code" maxlength="30" aria-label="Código" @change="renameProduct(ci, pi, 'code', $event)" />
                <select :id="`aj-pu-${blockKey}-${ci}-${pi}`" v-model="p.unit" aria-label="Unidad">
                  <option v-for="u in catalog.units" :key="u" :value="u">{{ u }}</option>
                </select>
                <button class="rm" :aria-label="`Borrar ${p.name}`" @click="removeProduct(ci, pi)">✕</button>
              </div>
              <div class="ajrow new">
                <input
                  :id="`aj-np-${blockKey}-${ci}`"
                  v-model="newProduct[ci]"
                  class="aj-in"
                  maxlength="80"
                  :placeholder="`Nuevo producto en ${c.name}…`"
                  @keydown.enter="addProduct(ci)"
                />
                <button class="btn sm" @click="addProduct(ci)">＋ Agregar producto</button>
              </div>
            </div>
            <div v-if="!block.categories.length" class="empty">Este bloque no tiene categorías. Crea la primera aquí abajo.</div>
          </div>
        </div>

        <div class="addline">
          <input id="aj-newcat" v-model="newCategory" class="aj-in" maxlength="80" placeholder="Nombre de la nueva categoría" @keydown.enter="addCategory" />
          <button class="btn sm" @click="addCategory">＋ Nueva categoría</button>
        </div>

        <div class="field">
          <span class="lab">Unidades de medida</span>
          <div class="chips">
            <span v-for="(u, i) in catalog.units" :key="u" class="chip">
              {{ u }}<button :disabled="catalog.units.length < 2" :aria-label="`Quitar ${u}`" @click="removeUnit(i)">✕</button>
            </span>
          </div>
          <div class="addline" style="max-width: 340px">
            <input id="aj-newunit" v-model="newUnit" class="aj-in" maxlength="20" placeholder="Nueva unidad (ej.: caja)" @keydown.enter="addUnit" />
            <button class="btn sm" @click="addUnit">＋ Agregar</button>
          </div>
        </div>
      </section>

      <div class="sticky-save">
        <span class="tot">
          <template v-if="saveError"><span class="error">{{ saveError }}</span></template>
          <template v-else-if="dirty">Tienes cambios sin guardar.</template>
          <template v-else>{{ saveMsg || 'Todo guardado.' }}</template>
        </span>
        <button class="btn" :disabled="!dirty || saving" @click="save">
          <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i> Guardar cambios
        </button>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
@use './inventory.scss';
</style>
