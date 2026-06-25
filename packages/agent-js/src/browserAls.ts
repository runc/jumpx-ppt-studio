import { AsyncLocalStorageProviderSingleton } from '@langchain/core/singletons'

/**
 * langgraph 的 `interrupt()` 只能通过全局 AsyncLocalStorage 取回当前 graph 运行的 config，
 * 而浏览器没有 node:async_hooks，langchain 默认装的是「永远返回 undefined」的 MockAsyncLocalStorage，
 * 于是 HITL 门禁（confirm_outline / choose_template / choose_render_mode）一调用 interrupt() 就抛
 * "Called interrupt() outside the context of a graph."。
 *
 * 这里提供一个最小可用、promise-aware 的浏览器 ALS：`run(store, cb)` 在异步回调 settle 之前
 * 都保持 getStore() 返回该 store，从而让 runnable 执行链里的 interrupt() 能拿到 config。
 * Lite 的门禁是顺序触发（一次一个 interrupt），不涉及并发 superstep，足以跑通端到端。
 */
class BrowserAsyncLocalStorage<T = unknown> {
  private store: T | undefined = undefined

  getStore(): T | undefined {
    return this.store
  }

  run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    const prev = this.store
    this.store = store
    try {
      const result = callback(...args)
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        return (result as unknown as Promise<unknown>).finally(() => {
          this.store = prev
        }) as unknown as R
      }
      this.store = prev
      return result
    } catch (err) {
      this.store = prev
      throw err
    }
  }

  enterWith(store: T): void {
    this.store = store
  }
}

let initialized = false

export function ensureBrowserAsyncLocalStorage(): void {
  if (initialized) return
  initialized = true
  if (typeof window === 'undefined') return
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new BrowserAsyncLocalStorage() as never,
  )
}

/** 在浏览器里为 langgraph stream/invoke 注入 RunnableConfig，interrupt() 与 Command resume 才能工作 */
export function runWithGraphConfig<R>(
  config: Record<string, unknown>,
  fn: () => R | Promise<R>,
): R | Promise<R> {
  ensureBrowserAsyncLocalStorage()
  return AsyncLocalStorageProviderSingleton.runWithConfig(
    config as Parameters<typeof AsyncLocalStorageProviderSingleton.runWithConfig>[0],
    fn,
  )
}
