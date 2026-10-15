import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '@/styles/global.scss'
// Controles de formulario con la marca (checkbox, radio, select, fecha) en toda la app.
import '@/styles/controls.scss'

import App from './App.vue'
import router from './router'

const app = createApp(App)

// Configurar Pinia
const pinia = createPinia()
app.use(pinia)
app.use(router)

app.mount('#app')
