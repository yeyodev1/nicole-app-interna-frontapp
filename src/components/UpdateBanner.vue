<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

// Intervalo de chequeo de nueva versión (ms): cada push a main publica una
// versión nueva y este modal avisa para actualizar sin forzar la recarga
// (una recarga forzada podría botar un cierre a medio llenar).
const CHECK_INTERVAL_MS = 60 * 1000

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, registration) {
    if (!registration) return
    // Buscar actualizaciones periódicamente aunque el usuario no navegue
    setInterval(() => registration.update().catch(() => {}), CHECK_INTERVAL_MS)
  },
  onRegisterError(error) {
    console.error('SW registration error:', error)
  },
})

const update = () => updateServiceWorker(true)
const dismiss = () => { needRefresh.value = false }
</script>

<template>
  <Transition name="update-fade">
    <div v-if="needRefresh" class="update-overlay" role="alertdialog" aria-labelledby="update-title">
      <div class="update-card">
        <div class="icon-circle">
          <i class="fa-solid fa-rocket"></i>
        </div>
        <h3 id="update-title">¡Hay una nueva versión!</h3>
        <p>Se publicaron mejoras en la app. Actualiza para verlas (toma 1 segundo).</p>
        <button class="btn-update" @click="update">
          <i class="fa-solid fa-arrow-rotate-right"></i>
          Actualizar ahora
        </button>
        <button class="btn-later" @click="dismiss">
          Ahora no — termino lo que estoy haciendo
        </button>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.update-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 30000;
  padding: 1rem;
}

.update-card {
  background: white;
  border-radius: 18px;
  padding: 2rem 1.75rem;
  width: 100%;
  max-width: 380px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  animation: update-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

  .icon-circle {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    color: white;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
    box-shadow: 0 6px 16px rgba(124, 58, 237, 0.35);
  }

  h3 {
    margin: 0 0 0.4rem;
    font-size: 1.25rem;
    color: #1e293b;
  }

  p {
    margin: 0 0 1.25rem;
    font-size: 0.9rem;
    color: #64748b;
    line-height: 1.5;
  }

  .btn-update {
    width: 100%;
    padding: 13px;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s;

    &:hover { background: #6d28d9; transform: translateY(-1px); }
  }

  .btn-later {
    margin-top: 0.75rem;
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;

    &:hover { color: #475569; }
  }
}

@keyframes update-pop {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.update-fade-enter-active,
.update-fade-leave-active { transition: opacity 0.25s ease; }
.update-fade-enter-from,
.update-fade-leave-to { opacity: 0; }
</style>
