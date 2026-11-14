import { useEffect, useRef, useState, type RefObject } from 'react'
import { Smile } from 'lucide-react'
import { toast } from 'sonner'
import { insertEmoji, loadEmoji, POST_LIMIT, searchEmoji, type EmojiGroup } from '../emoji'

/** One emoji that stands for each Unicode group on its tab. */
const TAB_ICON: Record<string, string> = {
  smileys_emotion: '😀', people_body: '👋', animals_nature: '🐻', food_drink: '🍔', travel_places: '✈️',
  activities: '⚽', objects: '💡', symbols: '❤️', flags: '🏳️',
}

/**
 * The emoji button of a post box. Opens a panel with every Unicode emoji,
 * grouped and searchable, and writes the pick into the text field at the cursor.
 */
export function EmojiPicker({ target, value, onChange, limit = POST_LIMIT }: { target: RefObject<HTMLTextAreaElement | null>; value: string; onChange: (text: string) => void; limit?: number }) {
  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [group, setGroup] = useState(0)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLSpanElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  /** Where the cursor was in the text field when it was last left, or after the last insert. */
  const cursor = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (!open) return
    if (!groups) loadEmoji().then(setGroups).catch(() => setFailed(true))
    searchRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false) } }
    const onDown = (event: PointerEvent) => { if (!wrapRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onDown) }
  }, [open, groups])

  // Remember where the cursor was each time the field is left. A field that was never touched has no cursor: the emoji goes at the end.
  useEffect(() => {
    const field = target.current
    if (!field) return
    const remember = () => { cursor.current = [field.selectionStart, field.selectionEnd] }
    field.addEventListener('blur', remember)
    return () => field.removeEventListener('blur', remember)
  }, [target])

  const toggle = () => setOpen((was) => !was)
  const pick = (emoji: string) => {
    const [start, end] = cursor.current ?? [value.length, value.length]
    const result = insertEmoji(value, emoji, start, end, limit)
    if (!result) { toast.error(`That would go past ${limit} characters`); return }
    onChange(result.text)
    cursor.current = [result.cursor, result.cursor]
  }

  const results = groups && query.trim() ? searchEmoji(groups, query) : null
  const shown = results ?? groups?.[group]?.emojis ?? []

  return <span className="x-emoji" ref={wrapRef}>
    <button type="button" className="x-emoji-toggle" aria-label="Add emoji" aria-expanded={open} aria-haspopup="dialog" onClick={toggle}><Smile size={19} aria-hidden="true" /></button>
    {open && <div className="x-emoji-panel" role="dialog" aria-label="Emoji">
      <input ref={searchRef} type="search" className="x-emoji-search" placeholder="Search emoji" aria-label="Search emoji" value={query} onChange={(event) => setQuery(event.target.value)} />
      {groups && !results && <div className="x-emoji-tabs" role="tablist" aria-label="Emoji groups">
        {groups.map((item, index) => <button key={item.slug} type="button" role="tab" aria-selected={index === group} aria-label={item.name} title={item.name} className={index === group ? 'active' : ''} onClick={() => setGroup(index)}>{TAB_ICON[item.slug] ?? item.emojis[0]?.emoji}</button>)}
      </div>}
      <div className="x-emoji-heading">{results ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : groups?.[group]?.name ?? (failed ? '' : 'Loading emoji…')}</div>
      {failed && <p className="x-emoji-empty" role="alert">The emoji list could not be loaded. Your keyboard’s emoji still work.</p>}
      {results?.length === 0 && <p className="x-emoji-empty">No emoji with that name.</p>}
      <div className="x-emoji-grid">
        {shown.map((entry) => <button key={entry.emoji} type="button" aria-label={entry.name} title={entry.name} onClick={() => pick(entry.emoji)}>{entry.emoji}</button>)}
      </div>
    </div>}
  </span>
}
