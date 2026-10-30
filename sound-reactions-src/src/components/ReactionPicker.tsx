import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Pause, Play, Search, Shuffle, Star } from 'lucide-react'
import { toast } from 'sonner'
import { HAS_GENERATED_AUDIO, SOUND_CATEGORIES, SOUND_LIBRARY } from '../data'
import { runPreflight } from '../governance'
import { audioController, useAudio } from '../audio'
import { emojiBurst, markLanding, padPress, staggerIn } from '../motion'
import { useAppStore } from '../store'
import type { Post, SoundCategory } from '../types'
import { Modal } from './Modal'

type Filter = 'All' | 'Favorites' | SoundCategory

/**
 * Soundboard-style picker. Borrowed from meme soundboards: a grid of named
 * buttons, categories, search, favorites and a random pick. Deliberately left
 * out: auto-play and tap-to-blast. Preview plays only for the person picking.
 */
export function ReactionPicker({ post, onClose }: { post: Post; onClose: () => void }) {
  const [selected, setSelected] = useState('applause')
  const [filter, setFilter] = useState<Filter>('All')
  const [query, setQuery] = useState('')
  const config = useAppStore((state) => state.config)
  const addReaction = useAppStore((state) => state.addReaction)
  const favorites = useAppStore((state) => state.favorites)
  const toggleFavorite = useAppStore((state) => state.toggleFavorite)
  const rateCount = useAppStore((state) => state.submissions.filter((item) => item.postId === post.id && Date.now() - new Date(item.submittedAt).getTime() < 3600000).length)
  const { state: playback } = useAudio()
  const gridRef = useRef<HTMLDivElement>(null)
  const clip = SOUND_LIBRARY.find((item) => item.id === selected) ?? SOUND_LIBRARY[0]

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SOUND_LIBRARY.filter((item) => {
      if (filter === 'Favorites' && !favorites.includes(item.id)) return false
      if (filter !== 'All' && filter !== 'Favorites' && item.category !== filter) return false
      return !q || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    })
  }, [filter, query, favorites])

  // Restagger the tiles whenever the set on screen changes.
  const visibleKey = visible.map((item) => item.id).join(',')
  useEffect(() => { staggerIn(gridRef.current?.querySelectorAll('.x-sound-tile'), { distance: 8, gap: 22 }) }, [visibleKey])

  const surprise = () => {
    const pool = visible.length ? visible : SOUND_LIBRARY
    const pick = pool[Math.floor(Math.random() * pool.length)]
    setSelected(pick.id)
    toast(`Picked ${pick.name}. Press preview to hear it.`)
  }

  const choose = () => {
    const result = runPreflight(clip, config, rateCount)
    if (result.decision === 'PASS') markLanding(post.id)
    addReaction(post.id, clip, result)
    audioController.stop()
    toast(result.decision === 'PASS' ? `${clip.name} reaction added` : `Reaction ${result.outcome === 'HOLD' ? 'held for review' : 'blocked'} by preflight`)
    onClose()
  }

  const filters: Filter[] = ['All', ...(favorites.length ? ['Favorites' as const] : []), ...SOUND_CATEGORIES]

  return <Modal title="Add a sound reaction" onClose={onClose} wide>
    <p className="x-picker-intro">{HAS_GENERATED_AUDIO ? `${SOUND_LIBRARY.length} sounds made with ElevenLabs and labeled as AI audio.` : `${SOUND_LIBRARY.length} original sounds, synthesized in your browser.`} Previews play only for you.</p>

    <div className="x-board-tools">
      <label className="x-board-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search sounds</span>
        <input type="search" placeholder="Search sounds" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <button className="x-board-shuffle" onClick={surprise}><Shuffle size={16} aria-hidden="true" /> Surprise me</button>
    </div>

    <div className="x-chip-row" role="group" aria-label="Sound categories">
      {filters.map((item) => <button key={item} className={`x-chip ${filter === item ? 'on' : ''}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}
    </div>

    <div className="x-sound-grid" role="radiogroup" aria-label="Sound reaction" ref={gridRef}>
      {visible.map((item) => {
        const isSelected = selected === item.id
        const isFavorite = favorites.includes(item.id)
        const previewing = playback.clipId === item.id && playback.status === 'playing'
        return <div key={item.id} className={`x-sound-tile ${isSelected ? 'selected' : ''} ${previewing ? 'previewing' : ''}`}>
          <button className="x-sound-select" role="radio" aria-checked={isSelected} onClick={() => setSelected(item.id)}>
            <span className="x-sound-emoji" aria-hidden="true">{item.emoji}</span>
            <strong>{item.name}</strong>
            <small>{item.duration}s</small>
            {isSelected && <span className="x-sound-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>}
          </button>
          <button className="x-sound-preview" onClick={(event) => {
            const tile = event.currentTarget.closest('.x-sound-tile')
            padPress(tile)
            if (!previewing) emojiBurst(tile?.querySelector('.x-sound-emoji'), item.emoji, 6)
            void audioController.play(item)
          }} aria-label={`Preview ${item.name} sound reaction, ${item.duration} s`}>
            {previewing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
          </button>
          <button className={`x-sound-fav ${isFavorite ? 'on' : ''}`} onClick={() => toggleFavorite(item.id)} aria-pressed={isFavorite} aria-label={`${isFavorite ? 'Remove' : 'Add'} ${item.name} ${isFavorite ? 'from' : 'to'} favorites`}>
            <Star size={13} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      })}
      {visible.length === 0 && <p className="x-board-empty">{filter === 'Favorites' ? 'Star a sound to keep it here.' : `No sounds match “${query}”.`}</p>}
    </div>

    <div className="x-picker-alt"><span aria-hidden="true">{clip.emoji}</span><p><strong>Everyone sees this text</strong>{clip.description}</p></div>
    <button className="x-primary-pill" onClick={choose}>Add {clip.name} reaction</button>
  </Modal>
}
