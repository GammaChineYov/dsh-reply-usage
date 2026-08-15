/**
 * ReplyUsage: one compact stat segment appended inside the reply's IconActions
 * clock label, after the run-time facts: the tokens this turn actually added
 * to the conversation context (uncached input + generated output, shown as
 * `＋` plus a transfer icon) plus the session's cumulative context-window
 * occupancy percent and this turn's cache-hit share. The token volume comes
 * pre-folded by the reply-usage definition (`matched`); occupancy reads the
 * framework's `contextPressure` projection, null until a provider reports both
 * pressure and a route capacity.
 */
import { Fragment, memo, type ReactNode } from 'react'
import type { UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the `contextPressure` / `contextBreakdown` SessionProjectionMap key merge.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import { ContextFlowIcon } from './ContextFlowIcon.tsx'
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

/**
 * Occupancy the NEXT request would start at if the user sent an instruction
 * right after this reply: this turn's final request prompt (which already
 * carries the whole history) plus this turn's generated output (the reply
 * enters history for the next request), over the window capacity. Null until
 * both a window capacity and a final prompt are known.
 */
function nextRequestOccupancy(
  promptBilledInput: number,
  outputTokens: number,
  contextWindow: number | undefined,
): number | null {
  if (contextWindow === undefined) return null
  return Math.min(100, Math.round(((promptBilledInput + outputTokens) / contextWindow) * 100))
}

/** Compact token formatting: 12345 -> 12.3K, 1234567 -> 1.2M. */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/**
 * The clock-label usage segment.
 * @param props - pre-folded turn usage, the projection seat, and the locale.
 * @returns the segment, or null while the turn reported nothing usable.
 */
export const ReplyUsage = memo(function ReplyUsage({
  matched, useProjection, t,
}: ReplyUsageProps) {
  const usage = matched.usage
  const contextWindow = useProjection('contextPressure')?.contextWindow
  const pct = nextRequestOccupancy(matched.promptBilledInput, matched.finalOutput, contextWindow)
  const billed = billedInput(usage)
  const added = addedContext(usage)
  if (added === 0 && pct === null) return null
  const parts: ReactNode[] = []
  if (added > 0) {
    const hit = billed > 0 ? Math.round((usage.cacheReadTokens / billed) * 100) : null
    parts.push(
      <span key="added" aria-label={t('usage.added', { tokens: formatTokens(added) })}>
        {'＋ '}
        <ContextFlowIcon ariaHidden />
        {` ${formatTokens(added)}`}
      </span>,
    )
    if (hit !== null) parts.push(`${t('usage.cache')} ${hit}%`)
  }
  if (pct !== null) parts.push(`${t('usage.context')} ${pct}%`)
  return (
    <>
      {' · '}
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? ' · ' : null}
          {part}
        </Fragment>
      ))}
    </>
  )
})

export interface ReplyUsageProps extends PropsLocale<typeof NS> {
  /** Per-turn usage published by the reply-usage definition. */
  matched: ReplyUsageTurnData
  useProjection: UseProjection
}
