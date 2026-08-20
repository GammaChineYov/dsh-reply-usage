/**
 * dsh-reply-usage, node half.
 *
 * Watches the session event stream and folds every provider-reported token
 * usage of one turn into a single record, then answers the client badge
 * through an HTTP route keyed by the closing message's id (assistant/message
 * events carry both messageId and turn). The browser half registers a
 * `conversation.chat.assistant-actions` entry (additive list slot — the
 * rc.8 `turnTail` chain is a single-winner election claimed by produced
 * files, so per-reply metadata must ride an additive list instead).
 *
 * The fold mirrors the classic reply-usage definition: each model step is a
 * separate request whose buckets (uncached input, cache writes, output) are
 * disjoint, so the turn total sums every step; a step's provisional
 * `assistant/chunk` usage is replaced by its `assistant/message` sample so
 * streaming re-reports never double count.
 */
import type { Context } from '@deepseek-ai/cordis'

/** One provider-reported usage sample, buckets kept apart for the hit %. */
export interface UsageRecord {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
}

/** One turn's folding state: per-step samples plus the final request's. */
interface TurnUsageState {
  steps: Map<number, UsageRecord>
  last: UsageRecord | undefined
}

/* ── Minimal local service faces (standalone build keeps no @deepseek-ai type tree) ── */

interface WebRouteLike {
  kind: 'exact' | 'prefix'
  path: string
  handler: (
    req: { url?: string },
    res: { writeHead(status: number, headers: Record<string, string>): unknown; end(body?: string): unknown },
  ) => void | Promise<void>
}

interface WebServerLike {
  register(route: WebRouteLike): () => void
}

interface HostContext {
  webServer: WebServerLike
  on(name: string, listener: (...args: unknown[]) => unknown): unknown
  effect(callback: () => unknown, label?: string): unknown
}

export const inject = ['webServer']

/** Normalize a provider usage sample into the always-present bucket shape. */
function bucketsFrom(usage: {
  readonly inputTokens?: unknown
  readonly outputTokens?: unknown
  readonly cacheReadTokens?: unknown
  readonly cacheWriteTokens?: unknown
}): UsageRecord | undefined {
  if (typeof usage.inputTokens !== 'number' || typeof usage.outputTokens !== 'number') return undefined
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: typeof usage.cacheReadTokens === 'number' ? usage.cacheReadTokens : 0,
    cacheWriteTokens: typeof usage.cacheWriteTokens === 'number' ? usage.cacheWriteTokens : 0,
  }
}

/** Per-session ledger caps, keeping a long-lived host from growing unbounded. */
const MAX_TURNS_PER_SESSION = 400
const MAX_MESSAGES_PER_SESSION = 2000
const MAX_SESSIONS = 200

export function apply(ctx: Context): void {
  const host = ctx as unknown as HostContext

  /** sessionId → turn → folding state. */
  const turns = new Map<string, Map<number, TurnUsageState>>()
  /** sessionId → messageId → turn. */
  const msgTurn = new Map<string, Map<string, number>>()

  host.on('session/event', (session, event) => {
    const ev = event as { type?: string; data?: Record<string, unknown> } | undefined
    if (ev === undefined || typeof ev.type !== 'string') return
    const sessionId = String((session as { id?: unknown } | undefined)?.id ?? '')
    if (sessionId === '') return
    const data = ev.data ?? {}
    const turn = typeof data.turn === 'number' ? data.turn : -1
    const step = typeof data.step === 'number' ? data.step : -1
    if (turn < 0 || step < 0) return

    let usage: UsageRecord | undefined
    if (ev.type === 'assistant/message') {
      usage = bucketsFrom(data.usage as Record<string, unknown> | undefined)
    } else if (ev.type === 'assistant/chunk') {
      const chunk = data.chunk as { type?: unknown; usage?: Record<string, unknown> } | undefined
      if (chunk !== undefined && chunk.type === 'usage') usage = bucketsFrom(chunk.usage)
    }
    if (usage === undefined) return

    let turnMap = turns.get(sessionId)
    if (turnMap === undefined) {
      if (turns.size >= MAX_SESSIONS) turns.delete(turns.keys().next().value as string)
      turnMap = new Map()
      turns.set(sessionId, turnMap)
    }
    let state = turnMap.get(turn)
    if (state === undefined) {
      if (turnMap.size >= MAX_TURNS_PER_SESSION) turnMap.delete(turnMap.keys().next().value as number)
      state = { steps: new Map(), last: undefined }
      turnMap.set(turn, state)
    }
    state.steps.set(step, usage)
    state.last = usage

    // Closing message identity → its turn, for the HTTP badge lookup.
    if (ev.type === 'assistant/message') {
      const msgId = (data.message as { id?: unknown } | undefined)?.id
      if (typeof msgId === 'string') {
        let map = msgTurn.get(sessionId)
        if (map === undefined) {
          map = new Map()
          msgTurn.set(sessionId, map)
        }
        map.set(msgId, turn)
        if (map.size >= MAX_MESSAGES_PER_SESSION) map.delete(map.keys().next().value as string)
      }
    }
  })

  // HTTP RPC for the client badge: /reply-usage/by-message?sessionId=..&messageId=..
  host.effect(() => host.webServer.register({
    kind: 'exact',
    path: '/reply-usage/by-message',
    handler: (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const sessionId = url.searchParams.get('sessionId')
      const messageId = url.searchParams.get('messageId')
      let body: unknown = null
      if (sessionId !== null && messageId !== null) {
        const turn = msgTurn.get(sessionId)?.get(messageId)
        const state = typeof turn === 'number' ? turns.get(sessionId)?.get(turn) : undefined
        if (state !== undefined && state.last !== undefined && state.steps.size > 0) {
          let inputTokens = 0
          let outputTokens = 0
          let cacheReadTokens = 0
          let cacheWriteTokens = 0
          for (const record of state.steps.values()) {
            inputTokens += record.inputTokens
            outputTokens += record.outputTokens
            cacheReadTokens += record.cacheReadTokens
            cacheWriteTokens += record.cacheWriteTokens
          }
          const last = state.last
          body = {
            usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens },
            promptBilledInput: last.inputTokens + last.cacheReadTokens + last.cacheWriteTokens,
            finalOutput: last.outputTokens,
          }
        }
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(body))
    },
  }), 'dsh-reply-usage: by-message route')
}
