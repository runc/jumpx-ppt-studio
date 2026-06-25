import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const dir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const uiAssetsPublic = path.resolve(dir, '../ui-assets/public')

const anthropicSdkClient = require.resolve('@anthropic-ai/sdk/client.mjs')
const anthropicJsonSchema = require.resolve('@anthropic-ai/sdk/lib/transform-json-schema.mjs')

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ include: ['process', 'path', 'util'] }),
  ],
  publicDir: uiAssetsPublic,
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@anthropic-ai/sdk/lib/transform-json-schema': anthropicJsonSchema,
      '@anthropic-ai/sdk': anthropicSdkClient,
      '@jumpx/adapters-browser/mock-data': path.resolve(dir, '../adapters-browser/src/mock-data.ts'),
      '@jumpx/adapters-browser': path.resolve(dir, '../adapters-browser/src'),
      '@jumpx/agent-js': path.resolve(dir, '../agent-js/src'),
      '@jumpx/core': path.resolve(dir, '../core/src'),
      '@jumpx/ui/styles/proto.css': path.resolve(dir, '../ui/src/styles/proto.css'),
      '@jumpx/ui': path.resolve(dir, '../ui/src'),
      '@jumpx/ports': path.resolve(dir, '../ports/src'),
      '@jumpx/forge-assets/skillBundle': path.resolve(dir, '../forge-assets/src/skillBundle.ts'),
      '@jumpx/forge-assets/skill-ref.json': path.resolve(dir, '../forge-assets/skill-ref.json'),
      '@jumpx/forge-assets': path.resolve(dir, '../forge-assets/src'),
      '@jumpx/ui-assets': path.resolve(dir, '../ui-assets'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5190,
  },
  worker: {
    format: 'es',
  },
})
