#!/usr/bin/env node
/**
 * 从 jumpx-ppt-forge 同步 ai-slide-producer skill 到 packages/forge-assets。
 * 默认 ref=v1.1.0（与 Dockerfile 一致）。已存在且 FORCE 未设则跳过。
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEST = path.join(ROOT, 'packages/forge-assets/ai-slide-producer')
const REF = process.env.SKILL_REF || 'v1.1.0'
const URL = process.env.SKILL_GIT_URL || 'https://github.com/JumpX-Labs/jumpx-ppt-forge.git'
const TMP = path.join(ROOT, 'packages/forge-assets/.sync-tmp')

const INCLUDE_DIRS = ['references', 'schemas', 'assets/style-presets', 'assets/examples']
const INCLUDE_FILES = ['SKILL.md']

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
}

function copyTree(srcDir, dstDir, filter) {
  if (!fs.existsSync(srcDir)) return
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, ent.name)
    const d = path.join(dstDir, ent.name)
    if (ent.isDirectory()) {
      if (filter && !filter(s, true)) continue
      copyTree(s, d, filter)
    } else if (!filter || filter(s, false)) {
      copyFile(s, d)
    }
  }
}

function shouldSkipFile(filePath) {
  const base = path.basename(filePath)
  if (base === '.DS_Store' || base.endsWith('.pyc')) return true
  if (filePath.includes('/images/')) return true
  if (filePath.includes('/scripts/')) return true
  if (filePath.includes('/docs/')) return true
  const ext = path.extname(base).toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.ppt', '.pptx'].includes(ext)) return true
  return false
}

function filter(p, isDir) {
  if (isDir) return true
  return !shouldSkipFile(p)
}

if (fs.existsSync(DEST) && !process.env.FORCE_SYNC) {
  const marker = path.join(DEST, 'SKILL.md')
  if (fs.existsSync(marker)) {
    console.log(`skill already at ${DEST} (set FORCE_SYNC=1 to refresh)`)
    process.exit(0)
  }
}

console.log(`sync skill: ${URL} @ ${REF}`)
rmrf(TMP)
fs.mkdirSync(path.dirname(TMP), { recursive: true })
execSync(`git clone --depth 1 --branch "${REF}" "${URL}" "${TMP}"`, { stdio: 'inherit' })
if (!fs.existsSync(path.join(TMP, 'SKILL.md'))) {
  console.error('❌ clone 成功但未找到 SKILL.md')
  process.exit(1)
}

rmrf(DEST)
fs.mkdirSync(DEST, { recursive: true })
for (const f of INCLUDE_FILES) copyFile(path.join(TMP, f), path.join(DEST, f))
for (const d of INCLUDE_DIRS) copyTree(path.join(TMP, d), path.join(DEST, d), filter)
rmrf(TMP)
const refMeta = { ref: REF, syncedAt: new Date().toISOString() }
fs.writeFileSync(
  path.join(ROOT, 'packages/forge-assets/skill-ref.json'),
  JSON.stringify(refMeta, null, 2) + '\n',
)
console.log(`✓ skill synced → ${DEST} (@ ${REF})`)
