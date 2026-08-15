/** `replyUsage` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'replyUsage'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'usage.added': '新增上下文 {tokens}',
  'usage.cache': '缓存',
  'usage.context': '上下文',
}

/** English dictionary (same key set). */
export const en: Record<ReplyUsageKey, string> = {
  'usage.added': 'Added context {tokens}',
  'usage.cache': 'cache',
  'usage.context': 'ctx',
}

/** Union of this namespace's dictionary keys. */
export type ReplyUsageKey = keyof typeof zh
