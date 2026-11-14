/**
 * Emoji for the post box: the full Unicode set (from `unicode-emoji-json`,
 * loaded only when the picker opens), a name search, and the one rule for
 * putting a picked emoji into a text field. DOM-free.
 */
export interface EmojiEntry { emoji: string; name: string }
export interface EmojiGroup { name: string; slug: string; emojis: EmojiEntry[] }

export const POST_LIMIT = 280

let cache: Promise<EmojiGroup[]> | null = null

/** Every emoji, grouped the way Unicode groups them. Fetched once, from the site's own bundle. */
export function loadEmoji(): Promise<EmojiGroup[]> {
  cache ??= import('unicode-emoji-json/data-by-group.json').then((module) =>
    (module.default as EmojiGroup[]).map(({ name, slug, emojis }) => ({ name, slug, emojis: emojis.map(({ emoji, name: label }) => ({ emoji, name: label })) })))
  return cache
}

/** Emoji whose name contains every word typed, in catalogue order. */
export function searchEmoji(groups: EmojiGroup[], query: string, limit = 120): EmojiEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const found: EmojiEntry[] = []
  for (const group of groups) {
    for (const entry of group.emojis) {
      if (words.every((word) => entry.name.includes(word))) found.push(entry)
      if (found.length >= limit) return found
    }
  }
  return found
}

/**
 * Puts `emoji` where the cursor is (replacing any selection). Returns the new
 * text and where the cursor goes, or null when it would not fit in the limit.
 */
export function insertEmoji(text: string, emoji: string, start: number, end: number, limit = POST_LIMIT): { text: string; cursor: number } | null {
  const from = Math.max(0, Math.min(start, text.length))
  const to = Math.max(from, Math.min(end, text.length))
  const next = text.slice(0, from) + emoji + text.slice(to)
  return next.length > limit ? null : { text: next, cursor: from + emoji.length }
}
