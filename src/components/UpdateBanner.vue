<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

// Cada push a main publica una versión nueva. El modal es obligatorio: no se
// puede seguir usando una versión vieja (los datos del cierre y la recepción
// cambian de forma). Se da una cuenta regresiva corta para que alcancen a
// guardar lo que estén escribiendo antes de la recarga.
const CHECK_INTERVAL_MS = 60 * 1000
const COUNTDOWN_SECONDS = 20

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, registration) {
    if (!registration) return
    // Chequeo inmediato (no esperar el primer intervalo) y luego periódico.
    registration.update().catch(() => {})
    setInterval(() => registration.update().catch(() => {}), CHECK_INTERVAL_MS)
  },
  onRegisterError(error) {
    console.error('SW registration error:', error)
  },
})

// El service worker está configurado con skipWaiting + clientsClaim: la versión
// nueva toma control sin pasar por el estado "waiting", así que `needRefresh`
// muchas veces no se dispara y la pestaña abierta se queda con el código viejo
// (por eso "recargué y no veo cambios"). El cambio de controlador es la señal
// fiable de que ya hay versión nueva sirviendo.
const controllerChanged = ref(false)
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    controllerChanged.value = true
  })
}

const showUpdate = computed(() => needRefresh.value || controllerChanged.value)

const secondsLeft = ref(COUNTDOWN_SECONDS)
const isUpdating = ref(false)
let ticker: number | undefined

const update = () => {
  if (isUpdating.value) return
  isUpdating.value = true
  updateServiceWorker(true)
  // Respaldo: si no había un worker "waiting" al que pedirle el relevo,
  // updateServiceWorker no recarga por su cuenta.
  window.setTimeout(() => window.location.reload(), 1500)
}

watch(showUpdate, (pending) => {
  if (!pending || ticker) return
  secondsLeft.value = COUNTDOWN_SECONDS
  ticker = window.setInterval(() => {
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) {
      window.clearInterval(ticker)
      update()
    }
  }, 1000)
})

onUnmounted(() => window.clearInterval(ticker))
</script>

<template>
  <Transition name="update-fade">
    <div v-if="showUpdate" class="update-overlay" role="alertdialog" aria-labelledby="update-title">
      <div class="update-card">
        <div class="glow" aria-hidden="true"></div>

        <div class="icon-circle">
          <i class="fa-solid fa-rocket"></i>
        </div>

        <span class="pill">Actualización requerida</span>
        <h3 id="update-title">Hay una versión nueva</h3>
        <p>
          Para seguir usando la app necesitas la última versión.
          <strong v-if="!isUpdating">Guarda lo que estés escribiendo</strong>
          <template v-if="!isUpdating"> antes de continuar.</template>
        </p>

        <button class="btn-update" :disabled="isUpdating" @click="update">
          <i :class="isUpdating ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-arrow-rotate-right'"></i>
          {{ isUpdating ? 'Actualizando…' : 'Actualizar ahora' }}
        </button>

        <div v-if="!isUpdating" class="countdown">
          <div class="bar">
            <div
              class="fill"
              :style="{ width: `${(secondsLeft / COUNTDOWN_SECONDS) * 100}%` }"
            ></div>
          </div>
          <span>Se actualizará automáticamente en {{ secondsLeft }}s</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.update-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(6px);
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
  padding: 2.25rem 1.9rem 1.75rem;
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

.countdown {
  margin-top: 1rem;

  .bar {
    height: 4px;
    background: #f1f5f9;
    border-radius: 99px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: linear-gradient(90deg, $purple-light, $NICOLE-PURPLE);
    border-radius: 99px;
    transition: width 1s linear;
  }

  span {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.76rem;
    font-weight: 600;
    color: #94a3b8;
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
