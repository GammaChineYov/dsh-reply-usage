/**
 * dsh-reply-usage, browser half: registers a compact per-reply usage badge
 * into the chat view's `conversation.chat.assistant-actions` list (additive,
 * so it coexists with the feedback and memory-footer actions; the rc.8
 * `turnTail` chain is a single-winner election claimed by produced files).
 * The host half folds provider usage out of the session events and serves it
 * over HTTP keyed by the closing message id; this entry fetches and renders.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ReplyUsageAction } from './ReplyUsageAction.tsx'
import { en, NS, zh, type ReplyUsageKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Reply-usage badge copy. */
    'replyUsage': ReplyUsageKey
  }
}

export { ReplyUsageAction } from './ReplyUsageAction.tsx'

/** Required services: the slot registry and the copy seat. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the dictionaries and the per-message action.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
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
