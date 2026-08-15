/**
 * Per-turn provider-reported token usage for the reply-usage footer line:
 * a state-only Conversation definition that folds every usage-carrying event
 * of the turn into one volume record. Each model step is a separate request;
 * the tokens a step introduces first enter as uncached input (or cache write)
 * and are cached reads on later steps — so the turn total must SUM the
 * disjoint buckets across every step, not keep the last sample. A step's own
 * provisional `assistant/chunk` usage is replaced by its `assistant/message`
 * (same turn/step) so streaming re-reporting never double counts.
 */
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'

/** One turn's billed token volume, cache buckets kept apart for the hit %. */
export interface ReplyUsageRecord {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
}

/** Turn-scoped business value published against the closing turn. */
export interface ReplyUsageTurnData {
  readonly usage: ReplyUsageRecord
  /**
   * Complete prompt size of this turn's final model request. Provider-reported,
   * so it is the true assembled prompt, not an estimate.
   */
  readonly promptBilledInput: number
  /**
   * Output tokens of the turn's final model step — the reply text that will
   * enter the next request's history. Paired with promptBilledInput it is the
   * occupancy a fork at this reply would start at.
   */
  readonly finalOutput: number
}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ConversationTurnDataMap {
    /** Provider-reported usage summed across the turn's model steps. */
    replyUsage: ReplyUsageTurnData
  }
}

interface ReplyUsageState {
  readonly turn: number
  /** Per-step contribution; a step's later sample replaces its earlier one. */
  readonly steps: ReadonlyMap<number, ReplyUsageRecord>
  /** The turn's final usage sample — the last request's reported volume. */
  readonly last: ReplyUsageRecord | undefined
}

/** The Definition's event type, so the extraction helper needs no SessionEvent import. */
type DefinitionEvent = Parameters<ConversationNodeDefinition['match']>[0]

/** Normalize a provider usage sample into the always-present bucket shape. */
function bucketsFrom(usage: {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
}): ReplyUsageRecord {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  }
}

/** The usage one event contributes, if any. */
function usageOf(event: DefinitionEvent): ReplyUsageRecord | undefined {
  if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
    return bucketsFrom(event.data.chunk.usage)
  }
  if (event.type === 'assistant/message') {
    const usage = event.data.usage
    return usage === undefined ? undefined : bucketsFrom(usage)
  }
  return undefined
}

/** Fold every step's disjoint buckets into the turn's cumulative volume. */
function foldSteps(steps: ReadonlyMap<number, ReplyUsageRecord>): ReplyUsageRecord | undefined {
  if (steps.size === 0) return undefined
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  for (const record of steps.values()) {
    inputTokens += record.inputTokens
    outputTokens += record.outputTokens
    cacheReadTokens += record.cacheReadTokens
    cacheWriteTokens += record.cacheWriteTokens
  }
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }
}

/**
 * Per-turn usage accumulator: starts on `turn/start`, replaces each step's
 * contribution as its reports land, and publishes the summed volume once the
 * turn has any.
 */
export const replyUsageDefinition: ConversationNodeDefinition<ReplyUsageState> = {
  kind: 'replyUsage',
  match: (event) => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
      return { id: String(event.data.turn), role: 'update' }
    }
    if (event.type === 'assistant/message' && event.data.usage !== undefined) {
      return { id: String(event.data.turn), role: 'update' }
    }
    return null
  },
  start: (_context, match) => {
    if (match.event.type !== 'turn/start') throw new Error('replyUsage start requires turn/start')
    return { turn: match.event.data.turn, steps: new Map(), last: undefined }
  },
  update: (context, match) => {
    const usage = usageOf(match.event)
    if (usage === undefined) return context.state
    const step = match.event.type === 'assistant/chunk' || match.event.type === 'assistant/message'
      ? match.event.data.step
      : -1
    if (step < 0) return context.state
    const steps = new Map(context.state.steps)
    steps.set(step, usage)
    // Updates arrive in log order, so the last usage event IS the final request.
    return { ...context.state, steps, last: usage }
  },
  buildLocationData: (context, scope) => {
    if (scope !== 'turn' || context.state === undefined) return null
    const usage = foldSteps(context.state.steps)
    const last = context.state.last
    if (usage === undefined || last === undefined) return null
    return {
      kind: 'turn',
      turn: context.state.turn,
      key: 'replyUsage',
      value: {
        usage,
        promptBilledInput: last.inputTokens + last.cacheReadTokens + last.cacheWriteTokens,
        finalOutput: last.outputTokens,
      },
    }
  },
}
