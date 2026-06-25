#!/usr/bin/env node
/**
 * Copy backend/preset_previews/*.png → packages/ui-assets/public/presets/
 * Run after `cd backend && python build_preset_previews.py` (Studio 侧生成)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'backend', 'preset_previews')
const dst = path.join(root, 'packages', 'ui-assets', 'public', 'presets')

if (!fs.existsSync(src)) {
  console.warn('[sync-preset-previews] skip: no backend/preset_previews (run build_preset_previews.py first)')
  process.exit(0)
}

fs.mkdirSync(dst, { recursive: true })
let n = 0
for (const f of fs.readdirSync(src)) {
  if (!f.endsWith('.png')) continue
  fs.copyFileSync(path.join(src, f), path.join(dst, f))
  n += 1
}
console.log(`[sync-preset-previews] copied ${n} PNG(s) → packages/ui-assets/public/presets/`)
