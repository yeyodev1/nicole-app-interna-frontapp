<script lang="ts">
import { ref } from 'vue'

// Un solo editor abierto a la vez en toda la pantalla.
const openId = ref<number | null>(null)
let seq = 0
</script>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Botón de comentario de un producto + editor dentro de la celda (la tabla tiene scroll y un
 * recuadro flotante se cortaría). Se usa en Detalle del Día y en Movimiento de inventario.
 * Con comentario el ícono sale amarillo; sin comentario, gris difuminado.
 */
const props = withDefaults(
  defineProps<{
    /** Comentario guardado (el que se edita); null si no hay. */
    comment: string | null
    /** Texto del tooltip cuando hay comentario(s); si falta, se usa `comment`. */
    tooltip?: string
    /** Nombre del producto, para las etiquetas accesibles. */
    productName: string
    placeholder?: string
    /** Solo ver: el botón no abre el editor (ej. Detalle del Día en Periodo). */
    readonly?: boolean
    /** Permite guardar vacío para borrar el comentario (el botón dice "Borrar"). */
    allowDelete?: boolean
    /** Guarda el texto (vacío = borrar, si allowDelete). Lanza error si falla. */
    save: (text: string) => Promise<void>
  }>(),
  { tooltip: '', placeholder: 'Escribe un comentario', readonly: false, allowDelete: false },
)

const id = ++seq
const isOpen = computed(() => openId.value === id)
const text = ref('')
const saving = ref(false)
const error = ref('')

const hasNote = computed(() => !!props.comment)
const title = computed(() => props.tooltip || props.comment || (props.readonly ? '' : 'Agregar comentario'))
const deleting = computed(() => props.allowDelete && hasNote.value && !text.value.trim())
const canSave = computed(() => !saving.value && (!!text.value.trim() || deleting.value))

function open() {
  if (props.readonly) return
  text.value = props.comment || ''
  error.value = ''
  openId.value = id
}
function close() {
  if (openId.value === id) openId.value = null
}
async function submit() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  try {
    await props.save(text.value.trim())
    close()
  } catch (err: any) {
    error.value = err?.response?.data?.message || 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="note-btn"
    :class="{ filled: hasNote, readonly }"
    :title="title"
    :aria-label="hasNote ? `Comentario de ${productName}: ${title}` : `Comentar ${productName}`"
    @click="open"
  >
    <i :class="hasNote ? 'fa-solid fa-comment-dots' : 'fa-regular fa-comment'"></i>
  </button>
  <div v-if="isOpen" class="note-pop" @keydown.esc="close">
    <textarea v-model="text" maxlength="500" rows="3" :placeholder="placeholder" :aria-label="`Comentario de ${productName}`"></textarea>
    <p v-if="error" class="note-err">{{ error }}</p>
    <div class="note-actions">
      <span>{{ text.length }}/500</span>
      <button type="button" class="ghost" @click="close">Cancelar</button>
      <button type="button" class="primary" :disabled="!canSave" @click="submit">
        {{ saving ? 'Guardando…' : deleting ? 'Borrar' : 'Guardar' }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.note-btn {
  margin-left: 0.35rem; border: none; background: transparent; cursor: pointer;
  color: #cbd5e1; opacity: 0.7; font-size: 0.85rem; padding: 2px 5px; border-radius: 6px; vertical-align: middle;
  &:hover, &:focus-visible { opacity: 1; color: #94a3b8; }
  // con comentario: amarillo; sin comentario: gris difuminado
  &.filled { color: #d97706; background: #fef3c7; opacity: 1; }
  &.readonly { cursor: help; }
}
.note-pop {
  margin: 0.4rem 0 0 auto; width: 260px; white-space: normal;
  background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.6rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.15); text-align: left; font-size: 0.82rem; font-weight: 400; color: #1e293b;
  textarea { width: 100%; box-sizing: border-box; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 0.45rem; font: inherit; resize: vertical; color: #1e293b; }
  textarea:focus { outline: none; border-color: #7c3aed; }
  .note-err { margin: 0.3rem 0 0; color: #dc2626; font-size: 0.75rem; }
  .note-actions { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.45rem;
    span { margin-right: auto; color: #94a3b8; font-size: 0.7rem; }
    button { border-radius: 8px; padding: 0.35rem 0.75rem; font-weight: 700; font-size: 0.78rem; cursor: pointer; border: 1px solid #e2e8f0; }
    .ghost { background: white; color: #475569; }
    .primary { background: #7c3aed; border-color: #7c3aed; color: white; }
    .primary:disabled { background: #cbd5e1; border-color: #cbd5e1; cursor: not-allowed; }
  }
}
</style>
