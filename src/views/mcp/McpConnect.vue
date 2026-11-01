<script setup lang="ts">
import { computed, ref } from 'vue'
import { connectorUrl, mcpService, type McpUser } from '@/services/mcp.service'

const props = defineProps<{ user: McpUser }>()
const emit = defineEmits<{ (e: 'updated', user: McpUser): void }>()

const url = computed(() => (props.user.connectorToken ? connectorUrl(props.user.connectorToken) : ''))
const copied = ref(false)
const busy = ref(false)

async function copy() {
  await navigator.clipboard.writeText(url.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function regenerate() {
  if (!confirm('¿Generar un link nuevo? El actual deja de funcionar y tendrás que pegar el nuevo en Claude.')) return
  busy.value = true
  try {
    emit('updated', await mcpService.regenerateMine())
  } catch (e) {
    alert((e as Error).message)
  } finally {
    busy.value = false
  }
}

const examples = [
  '¿Cuánto vendimos este mes, separado por Nicole y Sucrée?',
  '¿Qué entregas hay mañana y cuáles faltan por pagar?',
  'Top 10 de productos más vendidos de octubre.',
  '¿Qué facturas tienen error esta semana?',
]
</script>

<template>
  <section class="connect">
    <header>
      <h2>Conectar Claude</h2>
      <p>Datos en vivo de Nicole y Sucrée (pedidos, ventas, entregas y facturación). <strong>Solo lectura</strong>: Claude no puede crear ni cambiar nada.</p>
    </header>

    <div class="connect__link">
      <span class="connect__label"><i class="fa-solid fa-key"></i> Tu link secreto</span>
      <div class="connect__row">
        <code>{{ url }}</code>
        <button class="btn btn--primary" @click="copy">
          <i :class="copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'"></i> {{ copied ? 'Copiado' : 'Copiar' }}
        </button>
      </div>
      <p class="connect__warn">
        <i class="fa-solid fa-triangle-exclamation"></i> Es personal: no lo compartas. Si se filtró,
        <button class="connect__inline" :disabled="busy" @click="regenerate">genera uno nuevo</button>.
      </p>
    </div>

    <ol class="connect__steps">
      <li>
        <strong>Abre Claude</strong> (claude.ai o la app de escritorio) → tu nombre abajo a la izquierda →
        <strong>Configuración</strong> → <strong>Conectores</strong>.
      </li>
      <li>Toca <strong>Agregar conector personalizado</strong>.</li>
      <li>
        Nombre: <code>Nicole y Sucrée</code> · URL: <strong>pega tu link secreto</strong>. Deja vacío lo de
        "Configuración avanzada" y toca <strong>Agregar</strong>.
      </li>
      <li>
        En un chat nuevo, toca el botón <strong>+</strong> (o el ícono de herramientas) y activa
        <strong>Nicole y Sucrée</strong>.
      </li>
      <li>Pregunta en español, como le hablarías a una persona.</li>
    </ol>

    <div class="connect__examples">
      <span class="connect__label"><i class="fa-regular fa-comment"></i> Para empezar, prueba:</span>
      <ul>
        <li v-for="q in examples" :key="q">"{{ q }}"</li>
      </ul>
    </div>

    <p class="connect__note">
      <i class="fa-solid fa-shield-halved"></i> Si a una persona la desactivan o la quitan en
      <strong>Personas</strong>, su link deja de funcionar al instante, aunque ya esté conectado en Claude.
    </p>
  </section>
</template>

<style scoped lang="scss">
.connect {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 820px;

  h2 { margin: 0 0 0.3rem; color: #490f57; }
  header p { margin: 0; color: #4b4453; line-height: 1.5; }

  &__label { display: flex; align-items: center; gap: 0.4rem; font-weight: 700; color: #2d2433; margin-bottom: 0.5rem; }

  &__link {
    padding: 1.2rem;
    border-radius: 14px;
    background: #faf5fb;
    border: 1px solid #eadcef;
  }

  &__row {
    display: flex;
    gap: 0.6rem;
    align-items: stretch;
    flex-wrap: wrap;

    code {
      flex: 1 1 320px;
      min-width: 0;
      padding: 0.75rem 0.9rem;
      border-radius: 10px;
      background: #fff;
      border: 1px solid #ddd3e3;
      font-size: 0.82rem;
      word-break: break-all;
    }
  }

  &__warn { margin: 0.6rem 0 0; font-size: 0.85rem; color: #92400e; }
  &__inline { background: none; border: none; padding: 0; color: #812a73; font-weight: 700; text-decoration: underline; cursor: pointer; }

  &__steps {
    margin: 0;
    padding-left: 1.3rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    line-height: 1.55;
    color: #2d2433;

    code { background: #f3e8f5; padding: 0.1rem 0.4rem; border-radius: 6px; }
  }

  &__examples ul { margin: 0; padding-left: 1.2rem; color: #4b4453; line-height: 1.8; }
  &__note { margin: 0; padding: 0.9rem 1rem; border-radius: 12px; background: #eef7f0; color: #14532d; font-size: 0.9rem; }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.7rem 1.1rem;
  border-radius: 10px;
  border: none;
  font-weight: 700;
  cursor: pointer;

  &--primary { background: #490f57; color: #fff; }
}
</style>
