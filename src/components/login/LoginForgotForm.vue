<script setup lang="ts">
import { ref } from 'vue'
import AuthService from '@/services/auth.service'

const props = defineProps<{ initialEmail?: string }>()
const emit = defineEmits<{ (e: 'back'): void }>()

const forgotEmail = ref(props.initialEmail || '')
const sent = ref(false)
const isSending = ref(false)

const handleForgotPassword = async () => {
  if (!forgotEmail.value.trim()) return
  isSending.value = true
  try {
    await AuthService.forgotPassword(forgotEmail.value.toLowerCase().trim())
  } catch {
    // Respuesta genérica igual — no revelamos si el correo existe
  } finally {
    sent.value = true
    isSending.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleForgotPassword" class="login-form">
    <template v-if="!sent">
      <p class="hint">
        Escribe tu correo y te enviaremos un enlace para restablecer tu contraseña.
      </p>

      <label class="field">
        <span class="field-label">Correo electrónico</span>
        <span class="input-wrap">
          <i class="fa-regular fa-envelope"></i>
          <input
            type="email"
            v-model="forgotEmail"
            placeholder="tu@nicole.com.ec"
            autocomplete="email"
            required
            :disabled="isSending"
          />
        </span>
      </label>

      <button type="submit" class="btn-primary" :disabled="isSending">
        <span v-if="!isSending">Enviar enlace</span>
        <span v-else class="loader"></span>
      </button>
    </template>

    <div v-else class="success">
      <i class="fa-solid fa-envelope-open-text"></i>
      <p>
        Si el correo está registrado, recibirás un enlace para restablecer tu
        contraseña. Revisa tu bandeja de entrada (y spam).
      </p>
    </div>

    <button type="button" class="link-btn back" @click="emit('back')">
      <i class="fa-solid fa-arrow-left"></i> Volver a iniciar sesión
    </button>
  </form>
</template>

<style lang="scss" scoped>
@include login-form-fields;

.hint {
  margin: 0;
  font-size: 0.88rem;
  color: $text-light;
  line-height: 1.55;
}

.success {
  text-align: center;
  padding: 0.5rem 0;

  i { font-size: 2.2rem; color: $NICOLE-PURPLE; margin-bottom: 0.8rem; }

  p {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.6;
    color: $text-light;
  }
}

.link-btn.back {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;

  i { font-size: 0.75rem; }
}
</style>
