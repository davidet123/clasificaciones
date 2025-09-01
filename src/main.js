// import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// Leaflet CSS global
import 'leaflet/dist/leaflet.css';

// ⬇️ Nuevo: arranque global de Live
import { startAppBootstrap } from '@/boot/appBootstrap';

import App from './App.vue'
import router from './router'

const app = createApp(App)
const vuetify = createVuetify({
  components,
  directives,
})

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')

// Lanza el bootstrap una vez montada la app
startAppBootstrap();
