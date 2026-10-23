<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

// Cada push a main publica una versión nueva. El aviso NO fuerza nada: no hay
// cuenta regresiva ni recarga automática. La persona decide cuándo actualizar
// (una recarga a destiempo puede botar un cierre a medio llenar).
const CHECK_INTERVAL_MS = 60 * 1000

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, registration) {
    if (!registration) return
    // Chequeo inmediato y luego periódico.
    registration.update().catch(() => {})
    setInterval(() => registration.update().catch(() => {}), CHECK_INTERVAL_MS)
  },
  onRegisterError(error) {
    console.error('SW registration error:', error)
  },
})

// En modo 'prompt' la versión nueva queda esperando y `needRefresh` se
// enciende: nada se actualiza hasta que la persona lo acepte.
const hasUpdate = computed(() => needRefresh.value)

const dismissed = ref(false)
const isUpdating = ref(false)

// Si lo deja para después, el aviso no se pierde: queda una pastilla discreta.
const showModal = computed(() => hasUpdate.value && !dismissed.value)
const showPill = computed(() => hasUpdate.value && dismissed.value)

const update = () => {
  if (isUpdating.value) return
  isUpdating.value = true
  updateServiceWorker(true)
}
</script>

<template>
  <!-- Aviso central (se puede cerrar) -->
  <Transition name="update-fade">
    <div
      v-if="showModal"
      class="update-overlay"
      role="alertdialog"
      aria-labelledby="update-title"
      @click.self="dismissed = true"
    >
      <div class="update-card">
        <div class="glow" aria-hidden="true"></div>

        <div class="icon-circle">
          <i class="fa-solid fa-rocket"></i>
        </div>

        <span class="pill">Nueva versión disponible</span>
        <h3 id="update-title">Hay mejoras listas</h3>
        <p>
          Puedes actualizar cuando quieras. Si estás a medio llenar algo,
          <strong>termina primero</strong> y actualiza después.
        </p>

        <button class="btn-update" :disabled="isUpdating" @click="update">
          <i :class="isUpdating ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-arrow-rotate-right'"></i>
          {{ isUpdating ? 'Actualizando…' : 'Actualizar ahora' }}
        </button>

        <button v-if="!isUpdating" class="btn-later" @click="dismissed = true">
          Ahora no — sigo trabajando
        </button>
      </div>
    </div>
  </Transition>

  <!-- Pastilla discreta cuando lo dejó para después -->
  <Transition name="update-fade">
    <button v-if="showPill" class="update-pill" @click="update">
      <i :class="isUpdating ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-arrow-rotate-right'"></i>
      {{ isUpdating ? 'Actualizando…' : 'Actualizar app' }}
    </button>
  </Transition>
</template>

<style lang="scss" scoped>
.update-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 30000;
  padding: 1rem;
}

.update-card {
  position: relative;
  overflow: hidden;
  background: white;
  border-radius: 22px;
  padding: 2.25rem 1.9rem 1.6rem;
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
  animation: update-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.glow {
  position: absolute;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  height: 220px;
  background: radial-gradient(circle, rgba($NICOLE-PURPLE, 0.18), transparent 70%);
  pointer-events: none;
}

.icon-circle {
  position: relative;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: linear-gradient(135deg, $NICOLE-PURPLE, $purple-light);
  color: white;
  font-size: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.1rem;
  box-shadow: 0 10px 24px rgba($NICOLE-PURPLE, 0.4);
  animation: float 2.8s ease-in-out infinite;
}

.pill {
  display: inline-block;
  background: rgba($NICOLE-PURPLE, 0.07);
  color: $NICOLE-PURPLE;
  border: 1px solid rgba($NICOLE-PURPLE, 0.18);
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border-radius: 20px;
  margin-bottom: 0.7rem;
}

h3 {
  position: relative;
  margin: 0 0 0.5rem;
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
}

p {
  position: relative;
  margin: 0 0 1.4rem;
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.55;

  strong { color: #475569; }
}

.btn-update {
  position: relative;
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, $NICOLE-PURPLE, $purple-dark);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  box-shadow: 0 8px 20px rgba($NICOLE-PURPLE, 0.32);
  transition: transform 0.18s, box-shadow 0.18s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 26px rgba($NICOLE-PURPLE, 0.42);
  }

  &:disabled { opacity: 0.75; cursor: wait; }
}

.btn-later {
  margin-top: 0.85rem;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;

  &:hover { color: #475569; }
}

.update-pill {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  z-index: 30000;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.1rem;
  border: none;
  border-radius: 30px;
  background: linear-gradient(135deg, $NICOLE-PURPLE, $purple-dark);
  color: white;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba($NICOLE-PURPLE, 0.35);
  transition: transform 0.18s, box-shadow 0.18s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px rgba($NICOLE-PURPLE, 0.45);
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes update-pop {
  from { transform: scale(0.9) translateY(12px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.update-fade-enter-active,
.update-fade-leave-active { transition: opacity 0.25s ease; }
.update-fade-enter-from,
.update-fade-leave-to { opacity: 0; }
</style>
