<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from '@/composables/useToast'
import { whatsappUrl } from '@/utils/payphone'
import { copyText } from '@/utils/clientLink'

const props = defineProps<{
  isOpen: boolean
  url: string
  whatsappMessage: string
  customerPhone?: string
  orderId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'go-to-order'): void
}>()

const { success, error: showError } = useToast()

const message = computed(() => props.whatsappMessage || `Gestiona tu entrega aquí: ${props.url}`)

const copy = async () => {
  if (await copyText(props.url)) success('Link copiado')
  else showError('No se pudo copiar. Selecciónalo y cópialo a mano.')
}

// Lo principal: copiar el mensaje completo y pegarlo en el chat del cliente.
const copyMessage = async () => {
  if (await copyText(message.value)) success('Mensaje copiado: pégalo en el WhatsApp del cliente')
  else showError('No se pudo copiar. Selecciona el texto y cópialo a mano.')
}

const sendWhatsApp = () => {
  window.open(whatsappUrl(props.customerPhone, message.value), '_blank')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="modal-backdrop" @click.self="emit('close')">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="cl-success-title">
          <div class="success-icon"><i class="fa-solid fa-check"></i></div>
          <h2 id="cl-success-title">Venta registrada</h2>
          <p class="lead">
            Copia el mensaje y pégalo en el WhatsApp del cliente. En el link elige fecha, hora, dirección (o la isla de retiro) y sus datos de factura.
          </p>

          <textarea
            class="message-preview"
            :value="message"
            readonly
            rows="7"
            aria-label="Mensaje para el cliente"
            @focus="($event.target as HTMLTextAreaElement).select()"
          ></textarea>

          <button type="button" class="btn-primary" @click="copyMessage">
            <i class="fa-regular fa-copy"></i> Copiar mensaje
          </button>

          <div class="link-box">
            <input :value="url" readonly @focus="($event.target as HTMLInputElement).select()" />
            <button type="button" class="btn-copy" @click="copy" title="Copiar link">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>

          <ul class="facts">
            <li><i class="fa-regular fa-clock"></i> El link vence en 7 días. Lo puedes renovar desde el pedido.</li>
            <li><i class="fa-solid fa-bell"></i> Te avisamos aquí y por correo cuando el cliente lo complete.</li>
            <li><i class="fa-solid fa-ban"></i> El cliente no puede cambiar la dirección después de confirmar: solo ustedes.</li>
          </ul>

          <div class="actions">
            <button type="button" class="btn-wa" @click="sendWhatsApp">
              <i class="fa-brands fa-whatsapp"></i> Abrir WhatsApp con el mensaje
            </button>
            <button v-if="orderId" type="button" class="btn-secondary" @click="emit('go-to-order')">
              Ir al pedido
            </button>
            <button type="button" class="btn-text" @click="emit('close')">Nueva venta</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  background: white;
  border-radius: 18px;
  padding: 2rem;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
  text-align: center;
}

.success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #dcfce7;
  color: #16a34a;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  margin: 0 auto 1rem;
}

h2 {
  margin: 0 0 0.5rem;
  color: $NICOLE-PURPLE;
  font-family: $font-principal;
}

.lead {
  color: #475569;
  margin: 0 0 1.25rem;
  line-height: 1.5;
}

.message-preview {
  width: 100%;
  box-sizing: border-box;
  resize: none;
  padding: 0.8rem 0.9rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.45;
  color: #334155;
  text-align: left;
  margin-bottom: 0.75rem;
}

.btn-primary {
  width: 100%;
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 0.85rem;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  align-items: center;
  margin-bottom: 1rem;
}

.link-box {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;

  input {
    flex: 1;
    min-width: 0;
    padding: 0.7rem 0.8rem;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #f8fafc;
    font-size: 0.9rem;
  }
}

.btn-copy {
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 10px;
  padding: 0 0.9rem;
  cursor: pointer;
  color: #334155;
}

.facts {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  font-size: 0.85rem;
  color: #64748b;

  i {
    width: 18px;
    color: $NICOLE-PURPLE;
  }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.btn-wa {
  background: #22c55e;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 0.85rem;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  align-items: center;
}

.btn-secondary {
  background: white;
  border: 2px solid $NICOLE-PURPLE;
  color: $NICOLE-PURPLE;
  border-radius: 10px;
  padding: 0.7rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-text {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.4rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
