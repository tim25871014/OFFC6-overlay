import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { loadConfig } from './lib/config'

// Resolve endpoint URLs (tosu socket / bridge) before mounting so every view sees them.
loadConfig().finally(() => {
  createApp(App).use(router).mount('#app')
})
