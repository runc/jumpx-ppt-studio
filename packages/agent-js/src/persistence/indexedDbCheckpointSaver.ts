import {
  BaseCheckpointSaver,
  copyCheckpoint,
  getCheckpointId,
  maxChannelVersion,
  TASKS,
  WRITES_IDX_MAP,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointPendingWrite,
  type CheckpointTuple,
  type PendingWrite,
} from '@langchain/langgraph-checkpoint'
import type { RunnableConfig } from '@langchain/core/runnables'
import {
  assertSafeStorageKey,
  generateCheckpointKey,
  parseCheckpointKey,
} from './checkpointKeys.js'
import {
  idbDelete,
  idbGet,
  idbGetAllKeys,
  idbPut,
  type CheckpointRow,
  type CheckpointWriteRow,
} from './liteIdb.js'

function toStorageString(value: string | Uint8Array): string {
  return typeof value === 'string' ? value : new TextDecoder().decode(value)
}

export class LiteIndexedDBCheckpointSaver extends BaseCheckpointSaver {
  private async migratePendingSends(
    mutableCheckpoint: Checkpoint,
    threadId: string,
    checkpointNs: string,
    parentCheckpointId: string,
  ): Promise<void> {
    const parentKey = generateCheckpointKey(threadId, checkpointNs, parentCheckpointId)
    const writes = (await idbGet<CheckpointWriteRow>('checkpoint_writes', parentKey)) ?? {}
    const pendingSends = await Promise.all(
      Object.values(writes)
        .filter(([, channel]) => channel === TASKS)
        .map(async ([, , serialized]) => this.serde.loadsTyped('json', serialized)),
    )
    mutableCheckpoint.channel_values ??= {}
    mutableCheckpoint.channel_values[TASKS] = pendingSends
    mutableCheckpoint.channel_versions ??= {}
    mutableCheckpoint.channel_versions[TASKS] =
      Object.keys(mutableCheckpoint.channel_versions).length > 0
        ? maxChannelVersion(...Object.values(mutableCheckpoint.channel_versions))
        : this.getNextVersion(undefined)
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id
    const checkpointNs = config.configurable?.checkpoint_ns ?? ''
    let checkpointId = getCheckpointId(config)

    if (threadId !== undefined) {
      assertSafeStorageKey('thread_id', threadId)
    }
    assertSafeStorageKey('checkpoint_ns', checkpointNs, { allowEmpty: true })
    if (checkpointId) {
      assertSafeStorageKey('checkpoint_id', checkpointId)
    }

    if (threadId && checkpointId) {
      const key = generateCheckpointKey(threadId, checkpointNs, checkpointId)
      const saved = await idbGet<CheckpointRow>('checkpoints', key)
      if (!saved) return undefined

      const deserializedCheckpoint = await this.serde.loadsTyped('json', saved.checkpoint)
      if (deserializedCheckpoint.v < 4 && saved.parentCheckpointId !== undefined) {
        await this.migratePendingSends(
          deserializedCheckpoint,
          threadId,
          checkpointNs,
          saved.parentCheckpointId,
        )
      }

      const pendingWrites = await this.loadPendingWrites(key)
      const checkpointTuple: CheckpointTuple = {
        config,
        checkpoint: deserializedCheckpoint,
        metadata: await this.serde.loadsTyped('json', saved.metadata),
        pendingWrites,
      }
      if (saved.parentCheckpointId !== undefined) {
        checkpointTuple.parentConfig = {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointNs,
            checkpoint_id: saved.parentCheckpointId,
          },
        }
      }
      return checkpointTuple
    }

    if (!threadId) return undefined

    const allKeys = await idbGetAllKeys('checkpoints')
    const matching = allKeys
      .map((key) => ({ key, parsed: parseCheckpointKey(key) }))
      .filter(
        ({ parsed }) =>
          parsed.threadId === threadId && parsed.checkpointNamespace === checkpointNs,
      )
      .sort((a, b) => b.parsed.checkpointId.localeCompare(a.parsed.checkpointId))

    const latest = matching[0]
    if (!latest) return undefined

    checkpointId = latest.parsed.checkpointId
    const saved = await idbGet<CheckpointRow>('checkpoints', latest.key)
    if (!saved) return undefined

    const deserializedCheckpoint = await this.serde.loadsTyped('json', saved.checkpoint)
    if (deserializedCheckpoint.v < 4 && saved.parentCheckpointId !== undefined) {
      await this.migratePendingSends(
        deserializedCheckpoint,
        threadId,
        checkpointNs,
        saved.parentCheckpointId,
      )
    }

    const pendingWrites = await this.loadPendingWrites(latest.key)
    const checkpointTuple: CheckpointTuple = {
      config: {
        configurable: {
          thread_id: threadId,
          checkpoint_id: checkpointId,
          checkpoint_ns: checkpointNs,
        },
      },
      checkpoint: deserializedCheckpoint,
      metadata: await this.serde.loadsTyped('json', saved.metadata),
      pendingWrites,
    }
    if (saved.parentCheckpointId !== undefined) {
      checkpointTuple.parentConfig = {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: saved.parentCheckpointId,
        },
      }
    }
    return checkpointTuple
  }

  async *list(
    config: RunnableConfig,
    options?: {
      before?: RunnableConfig
      limit?: number
      filter?: Record<string, unknown>
    },
  ): AsyncGenerator<CheckpointTuple> {
    const { before, limit, filter } = options ?? {}

    if (config.configurable?.thread_id !== undefined) {
      assertSafeStorageKey('thread_id', config.configurable.thread_id)
    }

    const allKeys = await idbGetAllKeys('checkpoints')
    const parsedKeys = allKeys.map((key) => ({ key, parsed: parseCheckpointKey(key) }))
    const threadIds = config.configurable?.thread_id
      ? [config.configurable.thread_id]
      : [...new Set(parsedKeys.map(({ parsed }) => parsed.threadId))]

    const configCheckpointNamespace = config.configurable?.checkpoint_ns
    const configCheckpointId = config.configurable?.checkpoint_id
    let remaining = limit

    for (const threadId of threadIds) {
      const namespaces = [
        ...new Set(
          parsedKeys
            .filter(({ parsed }) => parsed.threadId === threadId)
            .map(({ parsed }) => parsed.checkpointNamespace),
        ),
      ]

      for (const checkpointNamespace of namespaces) {
        if (
          configCheckpointNamespace !== undefined &&
          checkpointNamespace !== configCheckpointNamespace
        ) {
          continue
        }

        const checkpoints = parsedKeys
          .filter(
            ({ parsed }) =>
              parsed.threadId === threadId && parsed.checkpointNamespace === checkpointNamespace,
          )
          .sort((a, b) => b.parsed.checkpointId.localeCompare(a.parsed.checkpointId))

        for (const { key, parsed } of checkpoints) {
          if (configCheckpointId && parsed.checkpointId !== configCheckpointId) continue
          if (
            before?.configurable?.checkpoint_id &&
            parsed.checkpointId >= before.configurable.checkpoint_id
          ) {
            continue
          }

          const saved = await idbGet<CheckpointRow>('checkpoints', key)
          if (!saved) continue

          const metadata = await this.serde.loadsTyped('json', saved.metadata)
          if (filter && !Object.entries(filter).every(([k, value]) => metadata[k] === value)) {
            continue
          }
          if (remaining !== undefined) {
            if (remaining <= 0) return
            remaining -= 1
          }

          const deserializedCheckpoint = await this.serde.loadsTyped('json', saved.checkpoint)
          if (deserializedCheckpoint.v < 4 && saved.parentCheckpointId !== undefined) {
            await this.migratePendingSends(
              deserializedCheckpoint,
              threadId,
              checkpointNamespace,
              saved.parentCheckpointId,
            )
          }

          const pendingWrites = await this.loadPendingWrites(key)
          const checkpointTuple: CheckpointTuple = {
            config: {
              configurable: {
                thread_id: threadId,
                checkpoint_ns: checkpointNamespace,
                checkpoint_id: parsed.checkpointId,
              },
            },
            checkpoint: deserializedCheckpoint,
            metadata,
            pendingWrites,
          }
          if (saved.parentCheckpointId !== undefined) {
            checkpointTuple.parentConfig = {
              configurable: {
                thread_id: threadId,
                checkpoint_ns: checkpointNamespace,
                checkpoint_id: saved.parentCheckpointId,
              },
            }
          }
          yield checkpointTuple
        }
      }
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    const preparedCheckpoint = copyCheckpoint(checkpoint)
    const threadId = config.configurable?.thread_id
    const checkpointNamespace = config.configurable?.checkpoint_ns ?? ''

    if (threadId === undefined) {
      throw new Error('Failed to put checkpoint. Missing required "thread_id".')
    }

    assertSafeStorageKey('thread_id', threadId)
    assertSafeStorageKey('checkpoint_ns', checkpointNamespace, { allowEmpty: true })
    assertSafeStorageKey('checkpoint_id', checkpoint.id)

    const [[, serializedCheckpoint], [, serializedMetadata]] = await Promise.all([
      this.serde.dumpsTyped(preparedCheckpoint),
      this.serde.dumpsTyped(metadata),
    ])

    const key = generateCheckpointKey(threadId, checkpointNamespace, checkpoint.id)
    await idbPut('checkpoints', key, {
      checkpoint: toStorageString(serializedCheckpoint),
      metadata: toStorageString(serializedMetadata),
      parentCheckpointId: config.configurable?.checkpoint_id,
    })

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNamespace,
        checkpoint_id: checkpoint.id,
      },
    }
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    const threadId = config.configurable?.thread_id
    const checkpointNamespace = config.configurable?.checkpoint_ns ?? ''
    const checkpointId = config.configurable?.checkpoint_id

    if (threadId === undefined) {
      throw new Error('Failed to put writes. Missing required "thread_id".')
    }
    if (checkpointId === undefined) {
      throw new Error('Failed to put writes. Missing required "checkpoint_id".')
    }

    assertSafeStorageKey('thread_id', threadId)
    assertSafeStorageKey('checkpoint_ns', checkpointNamespace, { allowEmpty: true })
    assertSafeStorageKey('checkpoint_id', checkpointId)
    assertSafeStorageKey('task_id', taskId)

    const outerKey = generateCheckpointKey(threadId, checkpointNamespace, checkpointId)
    const existing = (await idbGet<CheckpointWriteRow>('checkpoint_writes', outerKey)) ?? {}

    await Promise.all(
      writes.map(async ([channel, value], idx) => {
        const [, serializedValue] = await this.serde.dumpsTyped(value)
        const innerKey = [taskId, WRITES_IDX_MAP[channel] || idx]
        const innerKeyStr = `${innerKey[0]},${innerKey[1]}`
        const writeIndex = innerKey[1]
        if (typeof writeIndex === 'number' && writeIndex >= 0 && innerKeyStr in existing) {
          return
        }
        existing[innerKeyStr] = [taskId, channel, toStorageString(serializedValue)]
      }),
    )

    await idbPut('checkpoint_writes', outerKey, existing)
  }

  async deleteThread(threadId: string): Promise<void> {
    assertSafeStorageKey('thread_id', threadId)
    const checkpointKeys = await idbGetAllKeys('checkpoints')
    for (const key of checkpointKeys) {
      if (parseCheckpointKey(key).threadId === threadId) {
        await idbDelete('checkpoints', key)
        await idbDelete('checkpoint_writes', key)
      }
    }
  }

  private async loadPendingWrites(key: string): Promise<CheckpointPendingWrite[]> {
    const writes = (await idbGet<CheckpointWriteRow>('checkpoint_writes', key)) ?? {}
    return Promise.all(
      Object.values(writes).map(async ([taskId, channel, value]) => [
        taskId,
        channel,
        await this.serde.loadsTyped('json', value),
      ]),
    )
  }
}

let sharedCheckpointer: LiteIndexedDBCheckpointSaver | null = null

export function getLiteCheckpointer(): LiteIndexedDBCheckpointSaver {
  if (!sharedCheckpointer) {
    sharedCheckpointer = new LiteIndexedDBCheckpointSaver()
  }
  return sharedCheckpointer
}

export const ACTIVE_THREAD_KEY = 'aiartifacts-slide-studio-active-thread'
export const ACTIVE_TOPIC_KEY = 'aiartifacts-slide-studio-active-topic'
export const PRESENT_HTML_KEY_PREFIX = 'aiartifacts-present-html-'

export async function hasPersistedThread(threadId: string): Promise<boolean> {
  const allKeys = await idbGetAllKeys('checkpoints')
  return allKeys.some((key) => parseCheckpointKey(key).threadId === threadId)
}
