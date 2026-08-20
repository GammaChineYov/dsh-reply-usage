/**
 * dsh-reply-usage, browser half: folds provider usage per turn on the client
 * (a conversationEvents Definition, so the full replayed session log is
 * always available — complete folds across host restarts / plugin reloads)
 * and registers a compact per-reply usage badge into the chat view's
 * `conversation.chat.assistant-actions` list (additive, so it coexists with
 * the feedback and memory-footer actions). The badge reads the fold off the
 * closing message's turn from the conversation snapshot — no HTTP hop, no
 * host-side state.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ReplyUsageAction } from './ReplyUsageAction.tsx'
import { en, NS, zh, type ReplyUsageKey } from './locales.ts'
import { replyUsageDefinition } from './reply-usage-node.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Reply-usage badge copy. */
    'replyUsage': ReplyUsageKey
  }
}

export { ReplyUsageAction } from './ReplyUsageAction.tsx'
export { replyUsageDefinition, type ReplyUsageTurnData, type UsageRecord } from './reply-usage-node.ts'

/** Required services: the slot registry, the copy seat, and the conversation engine. */
export const inject = ['slots', 'locale', 'conversationEvents']

/**
 * Client plugin body: register the per-turn usage fold, the dictionaries, and
 * the per-message action.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // Self-disposing registration (kind-unique); mirrors the official
  // conversation-node registrations (assistant / turn-tail / …).
  ctx.conversationEvents.register(replyUsageDefinition)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-reply-usage: dictionaries')
  ctx.slots.inject(
    'conversation.chat.assistant-actions',
    () => ctx.slots.register({
      name: 'conversation.chat.assistant-actions',
      id: 'reply-usage',
      order: 15,
      locale: NS,
    }, ReplyUsageAction),
  )
}
