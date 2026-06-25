import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { activityFromMessages, findRunSlug, tasksFromTodos } from './stream-utils.ts'

describe('activityFromMessages', () => {
  it('extracts tool call labels', () => {
    const msgs = [
      {
        type: 'ai',
        tool_calls: [{ name: 'write_todos' }, { name: 'read_file' }],
      },
    ]
    assert.deepEqual(activityFromMessages(msgs), ['调用 read_file', '调用 write_todos'])
  })

  it('includes trimmed assistant text snippets', () => {
    const msgs = [{ role: 'assistant', content: '  正在规划大纲，请稍候…  ' }]
    assert.deepEqual(activityFromMessages(msgs), ['正在规划大纲，请稍候…'])
  })
})

describe('tasksFromTodos', () => {
  it('maps LangGraph todo statuses to UI states', () => {
    const rows = tasksFromTodos([
      { content: '写大纲', status: 'completed' },
      { content: '渲染', status: 'in_progress' },
      { content: '待办', status: 'pending' },
    ])
    assert.deepEqual(rows.map((r) => r.st), ['done', 'doing', 'todo'])
  })
})

describe('findRunSlug', () => {
  it('reads slug from virtual files path', () => {
    const stream = {
      messages: [],
      values: {
        files: { '/runs/demo-run/index.html': { content: '<html></html>' } },
      },
      interrupt: null,
      isLoading: false,
      error: null,
      awaitingUser: false,
      submit: async () => {},
    }
    assert.equal(findRunSlug(stream), 'demo-run')
  })
})
