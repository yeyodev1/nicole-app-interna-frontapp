<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import {
  productionEntryService,
  type ProductionTabletData,
  type ProductionCompany,
} from '@/services/production-entry.service'

/**
 * Ingreso de producción (tablet de planta). Dos pantallas:
 * 1) ¿Quién eres? empresa + operario + selfie con la cámara frontal.
 * 2) ¿Qué produjiste? área + productos agregados uno por uno + confirmar.
 * La selfie se comprime al mínimo: solo queda la última de cada operario.
 */

const data = ref<ProductionTabletData | null>(null)
const loading = ref(true)
const loadError = ref('')

const step = ref<0 | 1 | 2>(0)
const company = ref<ProductionCompany>('nicole')
const operatorId = ref<string | null>(null)
const photo = ref<string | null>(null)
const area = ref<string | null>(null)
const category = ref('')
const productCode = ref('')
const items = ref<Array<{ code: string; name: string; category: string; quantity: number }>>([])
const sending = ref(false)
const sendError = ref('')
const saved = ref<{ totalUnits: number; operatorName: string } | null>(null)

const todayLabel = computed(() => {
  const iso = data.value?.today
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date()
  return d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})
const operatorName = computed(() => data.value?.operators.find(o => o.id === operatorId.value)?.name || '')
const catalog = computed(() => data.value?.catalog[company.value] || [])
const categories = computed(() => Array.from(new Set(catalog.value.map(p => p.category))))
const productsInCategory = computed(() => catalog.value.filter(p => p.category === category.value))
const totalUnits = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))
const canContinue = computed(() => !!operatorId.value && !!photo.value)
const canSend = computed(() => !!area.value && items.value.length > 0 && !sending.value)
const freeDays = computed(() => data.value?.rules.freeDaysPerWeek ?? 2)
const fine = computed(() => data.value?.rules.finePerDay ?? 3)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    data.value = await productionEntryService.getTabletData()
  } catch (e: any) {
    loadError.value = e?.message || 'No se pudo cargar. Revisa el internet de la tablet.'
  } finally {
    loading.value = false
  }
}

function setCompany(c: ProductionCompany) {
  if (c === company.value) return
  company.value = c
  items.value = []
  category.value = ''
  productCode.value = ''
}

watch(categories, list => {
  if (!list.includes(category.value)) category.value = list[0] || ''
}, { immediate: true })

// ───────────── Cámara frontal ─────────────
const video = ref<HTMLVideoElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const cameraOn = ref(false)
const cameraError = ref('')
let stream: MediaStream | null = null

const hasLiveCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

function stopCamera() {
  stream?.getTracks().forEach(t => t.stop())
  stream = null
  cameraOn.value = false
}

async function startCamera() {
  cameraError.value = ''
  if (!hasLiveCamera) {
    // Sin cámara en vivo (navegador antiguo): se abre la cámara frontal del sistema
    fileInput.value?.click()
    return
  }
  try {
    stopCamera()
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
    cameraOn.value = true
    await nextTick()
    if (video.value) {
      video.value.srcObject = stream
      await video.value.play().catch(() => undefined)
    }
  } catch {
    cameraError.value = 'No se pudo abrir la cámara. Permite el acceso a la cámara en el iPad (Ajustes › Safari › Cámara) y vuelve a intentar.'
    stopCamera()
  }
}

/** Dibuja la imagen en un lienzo pequeño y la comprime a JPEG (~20–40 KB). */
function compress(source: CanvasImageSource, sw: number, sh: number, mirror: boolean): string {
  const maxSide = 320
  const scale = Math.min(1, maxSide / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (mirror) {
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(source, 0, 0, w, h)
  let quality = 0.6
  let url = canvas.toDataURL('image/jpeg', quality)
  while (url.length > 110_000 && quality > 0.2) {
    quality -= 0.1
    url = canvas.toDataURL('image/jpeg', quality)
  }
  return url
}

function takePhoto() {
  const v = video.value
  if (!v || !v.videoWidth) return
  photo.value = compress(v, v.videoWidth, v.videoHeight, true)
  stopCamera()
}

function retakePhoto() {
  photo.value = null
  startCamera()
}

function onFilePicked(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  const img = new Image()
  img.onload = () => {
    photo.value = compress(img, img.naturalWidth, img.naturalHeight, false)
    URL.revokeObjectURL(img.src)
  }
  img.src = URL.createObjectURL(file)
  ;(ev.target as HTMLInputElement).value = ''
}

function chooseOperator(id: string) {
  if (operatorId.value !== id) photo.value = null
  operatorId.value = id
  if (!photo.value) startCamera()
}

// ───────────── Productos ─────────────
function addProduct() {
  const p = catalog.value.find(x => x.code === productCode.value)
  if (!p) return
  const existing = items.value.find(i => i.code === p.code)
  if (existing) existing.quantity += 1
  else items.value.push({ ...p, quantity: 1 })
  productCode.value = ''
}
function inc(i: number) {
  const it = items.value[i]
  if (it) it.quantity += 1
}
function dec(i: number) {
  const it = items.value[i]
  if (it) it.quantity = Math.max(1, it.quantity - 1)
}
function setQty(i: number, ev: Event) {
  const it = items.value[i]
  if (!it) return
  const n = parseInt((ev.target as HTMLInputElement).value, 10)
  it.quantity = Number.isFinite(n) && n > 0 ? Math.min(n, 2000) : 1
}
function removeItem(i: number) { items.value.splice(i, 1) }

function goTo(n: 0 | 1) {
  step.value = n
  if (n === 0 && operatorId.value && !photo.value) startCamera()
  if (n === 1) stopCamera()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function send() {
  if (!canSend.value || !operatorId.value || !photo.value || !area.value) return
  sending.value = true
  sendError.value = ''
  try {
    const res = await productionEntryService.createEntry({
      operatorId: operatorId.value,
      company: company.value,
      area: area.value,
      items: items.value.map(i => ({ code: i.code, quantity: i.quantity })),
      photo: photo.value,
    })
    saved.value = { totalUnits: res.totalUnits, operatorName: res.operatorName }
    step.value = 2
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e: any) {
    sendError.value = e?.message || 'No se pudo guardar. Revisa el internet y vuelve a tocar "Confirmar y enviar".'
  } finally {
    sending.value = false
  }
}

function newEntry() {
  stopCamera()
  saved.value = null
  operatorId.value = null
  photo.value = null
  area.value = null
  items.value = []
  productCode.value = ''
  step.value = 0
  load()
}

onMounted(load)
onBeforeUnmount(stopCamera)
</script>

<template>
  <div class="pe-page">
    <header class="pe-head">
      <div class="ic"><i class="fa-solid fa-plus"></i></div>
      <div class="ht">
        <h1>Ingreso de producción</h1>
        <span class="today"><i class="fa-regular fa-calendar"></i> {{ todayLabel }}</span>
      </div>
    </header>
    <p class="sub">Registra lo que produjiste hoy. Son dos pantallas.</p>
    <div class="remind">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>Registra tu producción cada día que trabajas, antes de salir.
        <b>Solo se permiten {{ freeDays }} días sin registro por semana (tus descansos). Cada día de más genera una multa de ${{ fine }}.</b></span>
    </div>

    <div v-if="loading" class="panel muted">Cargando…</div>
    <div v-else-if="loadError" class="panel">
      <p class="error">{{ loadError }}</p>
      <button class="btn" @click="load">Reintentar</button>
    </div>

    <template v-else-if="data">
      <div v-if="step < 2" class="steps">
        <span class="st" :class="step === 0 ? 'on' : 'done'">{{ step > 0 ? '✓ ' : '' }}1. ¿Quién eres?</span>
        <span class="st" :class="{ on: step === 1 }">2. ¿Qué produjiste?</span>
      </div>

      <!-- Pantalla 1: empresa + operario + selfie -->
      <section v-if="step === 0" class="panel">
        <div class="field">
          <span class="lab">Empresa</span>
          <div class="seg">
            <button :class="{ sel: company === 'nicole' }" @click="setCompany('nicole')">Nicole</button>
            <button :class="{ sel: company === 'sucree' }" @click="setCompany('sucree')">Sucrée</button>
          </div>
        </div>

        <div class="two">
          <div class="field">
            <span class="lab">Operario</span>
            <div class="ops">
              <button
                v-for="o in data.operators"
                :key="o.id"
                class="tile"
                :class="{ sel: operatorId === o.id }"
                @click="chooseOperator(o.id)"
              >
                <span class="av">{{ o.name.charAt(0).toUpperCase() }}</span>{{ o.name }}
              </button>
            </div>
            <p v-if="!data.operators.length" class="muted">No hay operarios. Pide al Jefe de Operaciones que los agregue.</p>
          </div>

          <div class="field">
            <span class="lab">Selfie</span>
            <div class="cam" :class="{ taken: !!photo }">
              <img v-if="photo" :src="photo" alt="Selfie tomada" />
              <video v-else-if="cameraOn" ref="video" autoplay playsinline muted></video>
              <div v-else class="cam-empty">
                <i class="fa-solid fa-user"></i>
                <span>{{ operatorId ? 'Toca "Abrir cámara"' : 'Elige tu nombre' }}</span>
              </div>
              <span class="lbl">{{ photo ? '✓ Foto tomada' : cameraOn ? '● Cámara frontal' : 'Cámara' }}</span>
            </div>
            <p v-if="cameraError" class="error">{{ cameraError }}</p>
            <button v-if="photo" class="btn ghost" @click="retakePhoto">Repetir foto</button>
            <button v-else-if="cameraOn" class="btn" @click="takePhoto"><i class="fa-solid fa-camera"></i> Tomar foto</button>
            <button v-else class="btn" :disabled="!operatorId" @click="startCamera"><i class="fa-solid fa-camera"></i> Abrir cámara</button>
            <input ref="fileInput" class="hidden-input" type="file" accept="image/*" capture="user" @change="onFilePicked" />
          </div>
        </div>

        <div class="foot">
          <span class="tot">
            <template v-if="operatorName">Hola <b>{{ operatorName }}</b>{{ photo ? '' : ' · falta la selfie' }}</template>
            <template v-else>Elige tu nombre y tómate una selfie</template>
          </span>
          <button class="btn" :disabled="!canContinue" @click="goTo(1)">Continuar →</button>
        </div>
      </section>

      <!-- Pantalla 2: área + productos + confirmar -->
      <section v-else-if="step === 1" class="panel">
        <div class="who">
          <img v-if="photo" :src="photo" class="av big" alt="" />
          <div>
            <b>{{ operatorName }}</b>
            <span>{{ company === 'nicole' ? 'Nicole' : 'Sucrée' }}</span>
          </div>
          <button class="chg" @click="goTo(0)">Cambiar</button>
        </div>

        <div class="field">
          <span class="lab">Área</span>
          <div class="seg">
            <button v-for="a in data.areas" :key="a" :class="{ sel: area === a }" @click="area = a">{{ a }}</button>
          </div>
        </div>

        <div class="field">
          <span class="lab">Agregar producto</span>
          <div class="add">
            <div class="field">
              <label for="pe-cat">Categoría</label>
              <select id="pe-cat" v-model="category" @change="productCode = ''">
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="field">
              <label for="pe-prod">Producto</label>
              <select id="pe-prod" v-model="productCode">
                <option value="">Elige un producto…</option>
                <option v-for="p in productsInCategory" :key="p.code" :value="p.code">{{ p.name }} · {{ p.code }}</option>
              </select>
            </div>
            <button class="btn" :disabled="!productCode" @click="addProduct">＋ Agregar</button>
          </div>
        </div>

        <div class="field">
          <span class="lab">Producción de hoy · {{ items.length }} productos</span>
          <div v-if="items.length" class="plist">
            <div v-for="(i, ix) in items" :key="i.code" class="prow">
              <div class="nm">{{ i.name }}<span class="cd">{{ i.code }} · {{ i.category }}</span></div>
              <div class="qty">
                <button aria-label="Restar" @click="dec(ix)">−</button>
                <input :id="`pe-q-${i.code}`" inputmode="numeric" :value="i.quantity" :aria-label="`Cantidad de ${i.name}`" @change="setQty(ix, $event)" />
                <button aria-label="Sumar" @click="inc(ix)">+</button>
              </div>
              <button class="rm" :aria-label="`Quitar ${i.name}`" @click="removeItem(ix)">✕</button>
            </div>
          </div>
          <div v-else class="empty">Todavía no agregaste productos. Elige categoría y producto, toca “Agregar” y ajusta la cantidad con − / +.</div>
        </div>

        <p v-if="sendError" class="error">{{ sendError }}</p>
        <div class="foot">
          <span class="tot">Total <b>{{ totalUnits }}</b> unidades<template v-if="!area"> · falta elegir el área</template></span>
          <button class="btn" :disabled="!canSend" @click="send">
            <i v-if="sending" class="fa-solid fa-spinner fa-spin"></i>
            {{ sending ? 'Enviando…' : '✓ Confirmar y enviar' }}
          </button>
        </div>
      </section>

      <!-- Listo -->
      <section v-else class="panel">
        <div class="ok">✓ Listo, {{ saved?.operatorName }}. Tu ingreso de {{ saved?.totalUnits }} unidades quedó guardado.</div>
        <p class="muted">Tu ingreso ya aparece en el panel de Operaciones.</p>
        <div><button class="btn" @click="newEntry">Nuevo ingreso</button></div>
      </section>
    </template>
  </div>
</template>

<style lang="scss" scoped>
$violet: #7c3aed;
$violet-soft: #f3e8ff;
$line: #e8ecf2;
$soft: #f8fafc;
$muted: #64748b;

.pe-page {
  min-height: 100%;
  background: #fff;
  color: #1e293b;
  font-family: 'Inter', -apple-system, sans-serif;
  padding: 28px 24px 48px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.pe-head { display: flex; align-items: center; gap: 14px;
  .ic { width: 48px; height: 48px; border-radius: 12px; background: $violet; color: #fff; display: grid; place-items: center; font-size: 1.2rem; flex-shrink: 0; }
  .ht { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 1.6rem; font-weight: 800; }
}
.today { display: inline-flex; align-items: center; gap: 6px; font-size: .85rem; font-weight: 700; color: $violet; background: $violet-soft; border: 1px solid #ddd6fe; padding: 5px 12px; border-radius: 999px; text-transform: capitalize; }
.sub { color: $muted; margin: -8px 0 0; }
.remind { display: flex; gap: 10px; align-items: flex-start; background: #fffbeb; border: 1px solid #fde68a; color: #b45309; border-radius: 12px; padding: 12px 16px; font-size: .92rem; max-width: 900px; line-height: 1.45; }
.steps { display: flex; gap: 8px; flex-wrap: wrap; }
.st { font-size: .78rem; font-weight: 700; padding: 6px 12px; border-radius: 999px; background: $soft; color: $muted; border: 1px solid $line;
  &.on { background: $violet-soft; color: $violet; border-color: #ddd6fe; }
  &.done { background: #ecfdf5; color: #15803d; border-color: #a7f3d0; }
}
.panel { border: 1px solid $line; border-radius: 16px; padding: 24px; max-width: 900px; display: flex; flex-direction: column; gap: 20px; background: #fff; }
.muted { color: $muted; margin: 0; }
.error { color: #b91c1c; background: #fef2f2; border-radius: 10px; padding: 10px 12px; margin: 0; font-size: .9rem; }
.field { display: flex; flex-direction: column; gap: 8px; min-width: 0;
  > label { font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: $muted; }
}
.lab { font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: $muted; }
.seg { display: inline-flex; flex-wrap: wrap; gap: 4px; border: 1px solid $line; border-radius: 14px; padding: 4px; background: $soft; align-self: flex-start;
  button { font: inherit; font-weight: 700; font-size: 1rem; padding: 12px 22px; border: none; border-radius: 10px; background: transparent; color: #334155; cursor: pointer;
    &.sel { background: #fff; color: $violet; box-shadow: 0 1px 3px rgba(15, 23, 42, .12); }
  }
}
.two { display: grid; grid-template-columns: 1fr 260px; gap: 20px; align-items: start; }
.ops { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
.tile { border: 2px solid $line; background: #fff; border-radius: 14px; padding: 12px 8px; font: inherit; font-size: .95rem; font-weight: 700; color: #1e293b; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px;
  &.sel { border-color: $violet; background: $violet-soft; color: $violet; }
}
.av { width: 44px; height: 44px; border-radius: 50%; background: #f6eef4; color: #7b2d6b; display: grid; place-items: center; font-weight: 800; object-fit: cover; flex-shrink: 0;
  &.big { width: 56px; height: 56px; }
}
.cam { position: relative; width: 100%; aspect-ratio: 3 / 4; border-radius: 18px; background: #1f2433; overflow: hidden; display: grid; place-items: center;
  video, img { width: 100%; height: 100%; object-fit: cover; }
  video { transform: scaleX(-1); }
  .lbl { position: absolute; top: 12px; left: 12px; background: rgba(0, 0, 0, .55); color: #fff; font-size: .72rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
}
.cam-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; color: rgba(255, 255, 255, .7); font-size: .85rem; text-align: center; padding: 16px;
  i { font-size: 3.5rem; opacity: .5; }
}
.hidden-input { display: none; }
.btn { font: inherit; font-weight: 800; font-size: 1.05rem; border: none; border-radius: 14px; padding: 15px 22px; cursor: pointer; background: $violet; color: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  &:disabled { opacity: .4; cursor: not-allowed; }
  &.ghost { background: $soft; color: #334155; border: 1px solid $line; }
}
.who { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 12px; background: $soft;
  b { display: block; font-size: 1.05rem; }
  span { color: $muted; font-size: .85rem; }
  .chg { margin-left: auto; font: inherit; font-size: .9rem; font-weight: 700; color: $violet; background: none; border: none; cursor: pointer; }
}
.add { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: 10px; align-items: end; padding: 14px; border: 1px dashed #c4b5fd; border-radius: 14px; background: #fbf9ff;
  .btn { height: 52px; padding: 0 20px; }
}
select { font: inherit; font-size: 1rem; height: 52px; border: 1px solid $line; border-radius: 12px; padding: 0 12px; background: #fff; color: #1e293b; width: 100%; min-width: 0; }
.plist { display: flex; flex-direction: column; border: 1px solid $line; border-radius: 12px; overflow: hidden; }
.prow { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid $line;
  &:last-child { border-bottom: none; }
  .nm { flex: 1; min-width: 0; font-weight: 600; }
  .cd { font-size: .72rem; color: $muted; font-weight: 600; display: block; }
}
.qty { display: flex; align-items: center; gap: 6px;
  button { width: 44px; height: 44px; border-radius: 12px; border: 1px solid $line; background: $soft; font-size: 1.3rem; font-weight: 700; cursor: pointer; color: #1e293b; }
  input { width: 64px; height: 44px; text-align: center; font: inherit; font-size: 1.1rem; font-weight: 800; border: 1px solid $line; border-radius: 12px; font-variant-numeric: tabular-nums; }
}
.rm { width: 44px; height: 44px; border-radius: 12px; border: 1px solid #fecaca; background: #fff5f5; color: #b91c1c; font-size: 1.1rem; cursor: pointer; }
.empty { text-align: center; color: $muted; padding: 22px; border: 1px solid $line; border-radius: 12px; font-size: .9rem; }
.foot { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; border-top: 1px solid $line; padding-top: 16px;
  .tot { flex: 1; font-weight: 700; color: #334155; }
  .tot b { font-size: 1.3rem; color: #1e293b; font-variant-numeric: tabular-nums; }
}
.ok { background: #ecfdf5; color: #15803d; border-radius: 12px; padding: 14px 16px; font-weight: 700; }

@media (max-width: 760px) {
  .pe-page { padding: 20px 16px 40px; }
  .panel { padding: 16px; }
  .two { grid-template-columns: 1fr; }
  .add { grid-template-columns: 1fr; }
}
</style>
