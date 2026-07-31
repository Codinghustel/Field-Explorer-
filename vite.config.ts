import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import bitrix24UIPluginVite from '@bitrix24/b24ui-nuxt/vite'

export default defineConfig({
  plugins: [
    vue(),
    bitrix24UIPluginVite({
      router: false,
      prose: false
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts']
  }
})
