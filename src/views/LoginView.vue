<script setup lang="ts">
import { ref } from 'vue'
import LoginBrandPanel from '@/components/login/LoginBrandPanel.vue'
import LoginCredentialsForm from '@/components/login/LoginCredentialsForm.vue'
import LoginForgotForm from '@/components/login/LoginForgotForm.vue'

const showForgot = ref(false)
const forgotEmail = ref('')

const openForgot = (email: string) => {
  forgotEmail.value = email
  showForgot.value = true
}
</script>

<template>
  <div class="login-page">
    <LoginBrandPanel />

    <main class="form-panel">
      <div class="form-box">
        <div class="mobile-brand">
          <span class="brand-dot"></span>
          <span>Nicole <em>Pastry Arts</em></span>
        </div>

        <header class="form-head">
          <h1>{{ showForgot ? 'Recuperar acceso' : 'Bienvenida de nuevo' }}</h1>
          <p v-if="!showForgot">Entra con tu correo del equipo para continuar.</p>
        </header>

        <LoginForgotForm
          v-if="showForgot"
          :initial-email="forgotEmail"
          @back="showForgot = false"
        />
        <LoginCredentialsForm v-else @forgot="openForgot" />
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  min-height: 100vh;
  min-height: 100dvh;
  background: white;

  @media (max-width: 860px) { grid-template-columns: 1fr; }
}

.form-panel {
  display: grid;
  place-items: center;
  padding: 2rem 1.5rem;
  background: $background-cream;
}

.form-box {
  width: 100%;
  max-width: 390px;
  background: white;
  border: 1px solid rgba($NICOLE-PURPLE, 0.08);
  border-radius: 20px;
  padding: 2.25rem 2rem;
  box-shadow: 0 18px 45px rgba($NICOLE-PURPLE, 0.12);

  @media (max-width: 480px) { padding: 1.75rem 1.35rem; border-radius: 16px; }
}

.mobile-brand {
  display: none;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 1.5rem;
  font-size: 1rem;
  font-weight: 800;
  color: $NICOLE-PURPLE;

  em { font-style: normal; font-weight: 500; color: $text-light; }

  .brand-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: $NICOLE-PURPLE;
    box-shadow: 0 0 0 5px rgba($NICOLE-PURPLE, 0.12);
    flex-shrink: 0;
  }

  @media (max-width: 860px) { display: flex; }
}

.form-head {
  margin-bottom: 1.6rem;

  h1 {
    margin: 0 0 0.35rem;
    font-family: $font-principal;
    font-size: 1.6rem;
    font-weight: 700;
    color: #0f172a;
  }

  p { margin: 0; font-size: 0.89rem; color: $text-light; }
}
</style>
