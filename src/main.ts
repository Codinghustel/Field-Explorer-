import { createApp } from 'vue'
import b24UiPlugin from '@bitrix24/b24ui-nuxt/vue-plugin'
import App from './App.vue'
import './assets/main.css'

createApp(App).use(b24UiPlugin).mount('#app')
