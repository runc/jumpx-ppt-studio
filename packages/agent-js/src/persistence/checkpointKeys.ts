const POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function assertSafeStorageKey(
  field: string,
  value: unknown,
  options: { allowEmpty?: boolean } = {},
): asserts value is string {
  const { allowEmpty = false } = options
  if (typeof value !== 'string') {
    throw new Error(`Invalid configurable value for key "${field}"`)
  }
  if (!allowEmpty && value === '') {
    throw new Error(`Invalid configurable value for key "${field}": empty string`)
  }
  if (POLLUTION_KEYS.has(value)) {
    throw new Error(`Invalid configurable value for key "${field}": reserved`)
  }
}

export function generateCheckpointKey(
  threadId: string,
  checkpointNamespace: string,
  checkpointId: string,
): string {
  return JSON.stringify([threadId, checkpointNamespace, checkpointId])
}

export function parseCheckpointKey(key: string): {
  threadId: string
  checkpointNamespace: string
  checkpointId: string
} {
  const [threadId, checkpointNamespace, checkpointId] = JSON.parse(key) as [
    string,
    string,
    string,
  ]
  return { threadId, checkpointNamespace, checkpointId }
}
