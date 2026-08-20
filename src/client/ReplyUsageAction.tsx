/**
 * ReplyUsageAction: the per-message badge rendered inside the assistant
 * message's IconActions row (`conversation.chat.assistant-actions`, an
 * additive list slot so it coexists with the feedback and memory-footer
 * entries). For the closing message of a turn it fetches the turn's folded
 * token usage from the host route and shows the tokens this reply added to
 * the context plus the turn's cache-hit share. Hidden entirely while the
 * fetch is pending or the turn reported nothing usable.
 */
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from './locales.ts'

/** One turn's billed token volume, cache buckets kept apart for the hit %. */
interface UsageRecord {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
}

/** JSON body served by the host `/reply-usage/by-message` route. */
interface ReplyUsageBody {
  readonly usage: UsageRecord
  readonly promptBilledInput: number
  readonly finalOutput: number
}

export interface ReplyUsageActionProps extends PropsLocale<typeof NS> {
  /** Durable identity of the finalized assistant message (slot owner). */
  messageId?: string
  /** Current session id (list-slot standard seat). */
  sessionId?: string
}

/** Billed input of one usage record: uncached input plus cache traffic. */
function billedInput(usage: UsageRecord): number {
  return usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

/** Tokens this turn actually added to the conversation context: uncached
 * input and cache writes (new prompt material entering the context) plus
 * generated output. Cached reads are already-present content, not growth. */
function addedContext(usage: UsageRecord): number {
  return usage.inputTokens + usage.cacheWriteTokens + usage.outputTokens
}

/** Compact token formatting: 12345 -> 12.3K, 1234567 -> 1.2M. */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 6px',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary, #999)',
  font: 'inherit',
  fontSize: 12,
  lineHeight: 1.7,
  whiteSpace: 'nowrap',
}

/**
 * The per-reply usage badge.
 * @param props - the owner's message identity, the session seat, and locale.
 * @returns the token segment, or null while nothing usable is known.
 */
export function ReplyUsageAction({ messageId, sessionId, t }: ReplyUsageActionProps): ReactElement | null {
  const [body, setBody] = useState<ReplyUsageBody | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    setBody(null)
    setDone(false)
    if (messageId === undefined || sessionId === undefined) {
      setDone(true)
      return
    }
    const url = `/reply-usage/by-message?sessionId=${encodeURIComponent(sessionId)}&messageId=${encodeURIComponent(messageId)}`
    fetch(url)
      .then((response) => response.json())
      .then((data: unknown) => {
        if (cancelled) return
        setBody(data as ReplyUsageBody | null)
        setDone(true)
      })
      .catch(() => {
        if (!cancelled) setDone(true)
      })
    return () => { cancelled = true }
  }, [messageId, sessionId])

  if (!done || body === null) return null
  const usage = body.usage
  const billed = billedInput(usage)
  const added = addedContext(usage)
  if (added === 0) return null
  const hit = billed > 0 ? Math.round((usage.cacheReadTokens / billed) * 100) : null
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
