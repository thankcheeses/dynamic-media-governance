import { useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { audioController, useAudio } from '../audio'
import { SOUND_LIBRARY } from '../data'
import { useAppStore } from '../store'

type Row = { label: string; value: string; ok: boolean | null }

/**
 * A user-run check that plays one real sound and reports what happened, in
 * plain words, so a person can say exactly what failed on their device.
 * Starts only from the button press (no autoplay).
 */
export function SoundCheck() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const settings = useAppStore((state) => state.settings)
  useAudio()

  const run = async () => {
    const clip = SOUND_LIBRARY.find((item) => item.id === 'airhorn') ?? SOUND_LIBRARY[0]
    setRows([{ label: 'Status', value: 'Playing the airhorn now…', ok: null }])
    await audioController.play(clip)
    await new Promise((resolve) => setTimeout(resolve, 700))
    const level = audioController.readLevel()
    const { lastFileResult } = audioController.diagnostics
    const engine = audioController.engineState()
    const ua = navigator.userAgent
    const iphone = /iPhone|iPad/.test(ua)
    setRows([
      { label: 'Sound engine', value: engine === 'running' ? 'Running' : `Not running (${engine})`, ok: engine === 'running' },
      { label: 'Real sound file', value: clip.audioUrl ? lastFileResult : 'Not generated; using the backup sound', ok: clip.audioUrl ? lastFileResult.startsWith('loaded') : null },
      { label: 'Signal reaching speakers', value: level > 0.02 ? `Yes (level ${(level * 100).toFixed(0)}%)` : 'No signal measured', ok: level > 0.02 },
      { label: 'App mute', value: settings.muted ? 'On: turn off Global mute above' : 'Off', ok: !settings.muted },
      { label: 'App volume', value: `${Math.round(settings.volume * 100)}%`, ok: settings.volume > 0.05 },
      ...(iphone ? [{ label: 'iPhone', value: 'If you still hear nothing, flip the silent switch off and turn up the volume', ok: null }] : []),
    ])
  }

  return <section className="settings-section sound-check">
    <h2>Sound check</h2>
    <p className="muted">Plays the airhorn once and reports what worked. Send me a screenshot of the results if you hear nothing.</p>
    <button className="x-primary-pill sound-check-run" onClick={() => void run()}><Stethoscope size={18} aria-hidden="true" /> Run sound check</button>
    {rows && <dl className="sound-check-results" aria-live="polite">
      {rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd className={row.ok === true ? 'ok' : row.ok === false ? 'bad' : ''}>{row.ok === true ? '✓ ' : row.ok === false ? '✕ ' : ''}{row.value}</dd></div>)}
    </dl>}
  </section>
}
