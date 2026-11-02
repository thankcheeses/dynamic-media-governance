import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Check, Pause, Play, Search, Shuffle, Star, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { HAS_GENERATED_AUDIO, SOUND_CATEGORIES, SOUND_LIBRARY } from '../data'
import { runPreflight } from '../governance'
import { audioController, useAudio } from '../audio'
import { emojiBurst, markLanding, padPress, staggerIn } from '../motion'
import { useAppStore } from '../store'
import { analyzeSoundFile } from '../soundUpload'
import type { Clip, Post, SoundCategory } from '../types'
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
  // A sound the person uploaded from their device: decoded and measured here, kept in this tab only.
  const [uploaded, setUploaded] = useState<Clip | null>(null)
  const [uploadNotes, setUploadNotes] = useState<string[]>([])
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const config = useAppStore((state) => state.config)
  const addReaction = useAppStore((state) => state.addReaction)
  const favorites = useAppStore((state) => state.favorites)
  const toggleFavorite = useAppStore((state) => state.toggleFavorite)
  const rateCount = useAppStore((state) => state.submissions.filter((item) => item.postId === post.id && Date.now() - new Date(item.submittedAt).getTime() < 3600000).length)
  const { state: playback } = useAudio()
  const gridRef = useRef<HTMLDivElement>(null)
  const clip = selected === 'upload' && uploaded ? uploaded : SOUND_LIBRARY.find((item) => item.id === selected) ?? SOUND_LIBRARY[0]

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true); setUploadError('')
    try {
      audioController.stop()
      if (uploaded?.audioUrl) URL.revokeObjectURL(uploaded.audioUrl)
      const result = await analyzeSoundFile(file, 'reaction')
      setUploaded(result.clip); setUploadNotes(result.notes); setSelected('upload')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'That file could not be used')
    } finally {
      setUploading(false)
    }
  }

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
    if (clip.id.startsWith('upload-') && !clip.description.trim()) { toast.error('Describe the sound first so everyone can read what it is'); return }
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
      <button className="x-board-shuffle" onClick={() => fileRef.current?.click()} disabled={uploading}><Upload size={16} aria-hidden="true" /> {uploading ? 'Reading…' : 'Upload your own'}</button>
      <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm" className="sr-only" onChange={(event) => void pickFile(event)} data-testid="sound-upload" />
    </div>
    {uploadError && <p className="import-error" role="alert">{uploadError}</p>}

    <div className="x-chip-row" role="group" aria-label="Sound categories">
      {filters.map((item) => <button key={item} className={`x-chip ${filter === item ? 'on' : ''}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}
    </div>

    <div className="x-sound-grid" role="radiogroup" aria-label="Sound reaction" ref={gridRef}>
      {uploaded && <div className={`x-sound-tile x-sound-upload ${selected === 'upload' ? 'selected' : ''} ${playback.clipId === uploaded.id && playback.status === 'playing' ? 'previewing' : ''}`}>
        <button className="x-sound-select" role="radio" aria-checked={selected === 'upload'} onClick={() => setSelected('upload')}>
          <span className="x-sound-emoji" aria-hidden="true">{uploaded.emoji}</span>
          <strong>{uploaded.name}</strong>
          <small>{uploaded.duration}s · yours</small>
          {selected === 'upload' && <span className="x-sound-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>}
        </button>
        <button className="x-sound-preview" onClick={() => void audioController.play(uploaded)} aria-label={`Preview ${uploaded.name}, your uploaded sound, ${uploaded.duration} s`}>
          {playback.clipId === uploaded.id && playback.status === 'playing' ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>
      </div>}
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

    {selected === 'upload' && uploaded
      ? <div className="x-upload-describe">
          <label>Describe the sound <span className="fine-print">required, everyone sees this</span>
            <textarea value={uploaded.description} maxLength={160} rows={2} placeholder="What does it sound like? e.g. A short air horn blast" onChange={(event) => setUploaded({ ...uploaded, description: event.target.value, transcript: event.target.value })} />
          </label>
          <ul className="x-upload-notes">
            <li>{uploaded.duration}s · {uploaded.sizeKb} KB · about {uploaded.lufs} LUFS{uploaded.duration > config.durationLimit ? ` · over the ${config.durationLimit} s reaction cap, so preflight will block it` : ''}</li>
            {uploadNotes.map((note) => <li key={note}>{note}</li>)}
            <li>Stays in this tab; never uploaded anywhere.</li>
          </ul>
        </div>
      : <div className="x-picker-alt"><span aria-hidden="true">{clip.emoji}</span><p><strong>Everyone sees this text</strong>{clip.description}</p></div>}
    <button className="x-primary-pill" onClick={choose} disabled={selected === 'upload' && !uploaded?.description.trim()}>Add {clip.name} reaction</button>
  </Modal>
}
