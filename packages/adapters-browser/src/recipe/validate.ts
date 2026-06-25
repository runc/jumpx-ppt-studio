import type { RecipeManifest, ValidateResult } from '@jumpx/ports'
import { CONTRACT_VERSION, EDITABLE } from './constants.js'

export function validateRecipeFiles(
  files: Record<string, string>,
  manifest: RecipeManifest,
): ValidateResult {
  const errors: string[] = []
  if (!files['SKILL.md']?.trim()) {
    errors.push('缺 SKILL.md（管线/门禁，锁定层）')
  }
  if (!files['schemas/slide_plan.schema.json']?.trim()) {
    errors.push('缺 schemas/slide_plan.schema.json（产物契约，锁定层）')
  }
  for (const f of EDITABLE) {
    if (!files[f]?.trim()) {
      errors.push(`缺可改文件 ${f}`)
    }
  }
  if (String(manifest.contract_version || CONTRACT_VERSION) !== CONTRACT_VERSION) {
    errors.push(
      `contract 版本不符（${manifest.contract_version} ≠ ${CONTRACT_VERSION}），需更新后复验`,
    )
  }
  return { ok: errors.length === 0, errors }
}

export function assertEditablePath(rel: string) {
  const norm = rel.replace(/\\/g, '/')
  if (!(EDITABLE as readonly string[]).includes(norm)) {
    throw new Error(`锁定/不可改文件，拒绝写入: ${rel}`)
  }
}
