/**
 * dsh-reply-usage, browser half: registers a compact usage line into the
 * chat view's `conversation.chat.turnTail` chain, right above each finished
 * reply's IconActions footer. A per-turn usage definition folds provider
 * usage out of the session events; the line shows the turn's billed
 * input/output tokens and the session's cumulative context-window occupancy
 * %, so a big reply or a near-cap context is visible at a glance.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ReplyUsage } from './ReplyUsage.tsx'
import { en, NS, zh, type ReplyUsageKey } from './locales.ts'
import { replyUsageDefinition, type ReplyUsageTurnData } from './reply-usage-node.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Reply-usage footer copy. */
    'replyUsage': ReplyUsageKey
  }
}

export { ReplyUsage } from './ReplyUsage.tsx'

/** Required services: the slot registry, the copy seat, and the conversation engine. */
export const inject = ['slots', 'locale', 'conversationEvents']

/** Claim the turn-tail chain only when the closing turn reported provider usage. */
function selectReplyUsage(owner: TurnTailOwnerProps): ReplyUsageTurnData | null {
  return owner.turn.data.get('replyUsage') ?? null
}

/**
 * Client plugin body: register the usage fold, the dictionaries, and the
 * turn-tail entry.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-reply-usage: dictionaries')
  ctx.conversationEvents.register(replyUsageDefinition)
  ctx.slots.inject(
    'conversation.chat.turnTail',
    () => ctx.slots.register({
      name: 'conversation.chat.turnTail',
      select: selectReplyUsage,
      locale: NS,
    }, ReplyUsage),
  )
}
