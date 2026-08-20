/**
 * ReplyUsageAction: the per-message badge rendered inside the assistant
 * message's IconActions row (`conversation.chat.assistant-actions`, an
 * additive list slot so it coexists with the feedback and memory-footer
 * entries). For the closing message of a turn it reads the turn's folded
 * token usage straight from the conversation snapshot (client-side fold, see
 * reply-usage-node.ts) and shows the tokens this reply added to the context
 * plus the turn's cache-hit share. Hidden entirely while the closing turn
 * reported nothing usable.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { ConversationSnapshot, UseConversationSession } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the `assistant-step` StepDataMap key merge published by ui-conversation.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from './locales.ts'
import type { ReplyUsageTurnData } from './reply-usage-node.ts'

/** Billed input of one usage record: uncached input plus cache traffic. */
function billedInput(usage: ReplyUsageTurnData['usage']): number {
  return usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

/** Tokens this turn actually added to the conversation context: uncached
 * input and cache writes (new prompt material entering the context) plus
 * generated output. Cached reads are already-present content, not growth. */
function addedContext(usage: ReplyUsageTurnData['usage']): number {
  return usage.inputTokens + usage.cacheWriteTokens + usage.outputTokens
}

/** Compact token formatting: 12345 -> 12.3K, 1234567 -> 1.2M. */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/**
 * Resolve the closing message's turn and read its folded usage from the
 * conversation snapshot. Scoped to the exact assistant message the badge is
 * rendered for: scans each turn's steps for the assistant step whose durable
 * final node carries this messageId, then returns that turn's `replyUsage`.
 * The turn data is published by the replyUsage Definition, which folds the
 * FULL session log (including replayed history), so the value is complete
 * and stable across host restarts and plugin reloads.
 */
function turnUsageOf(snapshot: ConversationSnapshot, messageId: string): ReplyUsageTurnData | undefined {
  for (const turn of snapshot.chat.timeline.turns.values()) {
    for (const step of turn.steps) {
      const assistant = step.data.get('assistant-step')
      if (assistant?.finalNode?.messageId !== messageId) continue
      return turn.data.get('replyUsage')
    }
  }
  return undefined
}

export interface ReplyUsageActionProps extends PropsLocale<typeof NS> {
  /** Durable identity of the finalized assistant message (slot owner). */
  messageId?: string
  /** Session-scope standard seat: conversation snapshot selector. */
  useSession: UseConversationSession
}

const chipStyle: CSSProperties = {
  // Mirrors the assistant clock label (MessageIconActions .timeEnd): small
  // tertiary text reading as a continuation of "15:15 · 用时 … · 119 tok/s".
  paddingLeft: 12,
  fontSize: 14,
  lineHeight: 24,
  color: 'var(--dsw-alias-label-tertiary)',
  whiteSpace: 'nowrap',
}

/**
 * The per-reply usage badge.
 * @param props - the owner's message identity, the snapshot seat, and locale.
 * @returns the token segment, or null while nothing usable is known.
 */
export function ReplyUsageAction({ messageId, useSession, t }: ReplyUsageActionProps): ReactElement | null {
  const usage = useSession(snapshot =>
    messageId === undefined ? undefined : turnUsageOf(snapshot, messageId))
  if (usage === undefined) return null
  const billed = billedInput(usage.usage)
  const added = addedContext(usage.usage)
  if (added === 0) return null
  const hit = billed > 0 ? Math.round((usage.usage.cacheReadTokens / billed) * 100) : null
  const parts: ReactNode[] = [
    <span key="added">{`＋ ${formatTokens(added)}`}</span>,
  ]
  if (hit !== null) parts.push(`${t('usage.cache')} ${hit}%`)
  return (
    <span
      style={chipStyle}
      title={t('usage.added', { tokens: formatTokens(added) })}
      data-reply-usage
    >
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? ' · ' : null}
          {part}
        </span>
      ))}
    </span>
  )
}
