import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, AudioLines, CheckCircle2, Mic2, Pause, Play, ShieldCheck, Square } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { audioController, useAudio } from '../audio'
import { PreflightPanel } from '../components/PreflightPanel'
import { Toggle } from '../components/Toggle'
import { SOUND_LIBRARY, VOICE_DEMO } from '../data'
import { runPreflight } from '../governance'
import { useAppStore } from '../store'
import type { Clip, MediaKind } from '../types'

export default function Composer() {
  const navigate = useNavigate()
  const { config, settings, setSetting, publish } = useAppStore()
  const { state: playback, stop } = useAudio()
  const [kind, setKind] = useState<MediaKind>('reaction')
  const [clip, setClip] = useState<Clip>({ ...SOUND_LIBRARY[0] })
  const [postText, setPostText] = useState('A quieter way to add tone to the conversation.')
  const [recordingExplainer, setRecordingExplainer] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordError, setRecordError] = useState('')
  const [, setSimulatedRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const secondsRef = useRef(0)
  const cancelRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const result = runPreflight(clip, config)
  const isPlaying = playback.clipId === clip.id && playback.status === 'playing'
  const maxRecord = kind === 'voice' ? 140 : 8

  const updateClip = (patch: Partial<Clip>) => setClip((current) => ({ ...current, ...patch }))
  const switchKind = (value: MediaKind) => {
    stop(); setKind(value); setSimulatedRecording(false); setRecordError('')
    setClip(value === 'voice' ? { ...VOICE_DEMO } : { ...SOUND_LIBRARY[0] })
  }
  const scenario = (name: 'pass' | 'transcript' | 'long' | 'abuse') => {
    const base = { ...SOUND_LIBRARY[0], id: `scenario-${name}`, name: name === 'pass' ? 'Applause' : 'Demo scenario' }
    if (name === 'transcript') Object.assign(base, { transcript: '', description: '' })
    if (name === 'long') Object.assign(base, { duration: 12, description: 'A twelve-second clip used to demonstrate duration policy.' })
    if (name === 'abuse') Object.assign(base, { abuse: true, description: 'SIMULATED abusive clip for escalation testing; no abusive audio is played.' })
    setKind('reaction'); setClip(base); setSimulatedRecording(false)
    toast.info(`Loaded ${name === 'pass' ? 'harmless' : name === 'transcript' ? 'missing transcript' : name === 'long' ? '12-second' : 'SIMULATED abuse'} scenario`)
  }

  const clearRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setRecording(false)
  }, [])
  const stopRecording = useCallback(() => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); clearRecording() }, [clearRecording])
  const cancelRecording = () => { cancelRef.current = true; stopRecording(); setRecordSeconds(0); secondsRef.current = 0 }
  useEffect(() => () => { cancelRef.current = true; if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); clearRecording() }, [clearRecording])
  useEffect(() => { if (recording && recordSeconds >= maxRecord) stopRecording() }, [recordSeconds, recording, maxRecord, stopRecording])

  const beginRecording = async () => {
    setRecordError(''); cancelRef.current = false
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Capture is not supported in this browser')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        if (cancelRef.current) return
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const duration = Math.max(1, secondsRef.current)
        const url = URL.createObjectURL(blob)
        setClip({
          id: `recorded-${Date.now()}`, name: kind === 'voice' ? 'Recorded voice post' : 'Recorded sound reaction', kind,
          duration, description: 'Locally recorded microphone audio. Add a transcript or description before publishing.', transcript: '', emoji: kind === 'voice' ? '🎙️' : '🎵',
          sizeKb: Math.max(1, Math.ceil(blob.size / 1024)), lufs: -18, aiDeclared: false, aiLabel: false, abuse: false, copyright: false, audioUrl: url,
        })
        toast.success('Recording captured locally. Add a text description.')
      }
      recorder.start()
      secondsRef.current = 0; setRecordSeconds(0); setRecording(true); setRecordingExplainer(false)
      timerRef.current = setInterval(() => { secondsRef.current += 1; setRecordSeconds(secondsRef.current) }, 1000)
    } catch (error) {
      clearRecording()
      setRecordingExplainer(false)
      setRecordError(error instanceof Error ? error.message : 'Microphone permission was denied')
    }
  }
  const useSimulatedRecording = () => {
    setSimulatedRecording(true); setRecordError(''); setRecordingExplainer(false)
    setClip({ ...(kind === 'voice' ? VOICE_DEMO : SOUND_LIBRARY[0]), id: `simulated-recording-${kind}`, name: `SIMULATED recorded ${kind === 'voice' ? 'voice post' : 'reaction'}`, simulated: true, transcript: '', description: 'SIMULATED capture flow. This is synthesized demo audio, not microphone input.' })
  }
  const submit = () => {
    const submissionId = publish(clip, postText, kind, result)
    audioController.stop()
    if (result.decision === 'PASS') { toast.success('Published into the local demo feed'); navigate('/') }
    else if (result.decision === 'REVIEW') { toast.warning('Held in the simulated review queue'); navigate('/governance', { state: { submissionId } }) }
    else toast.error('Blocked by policy. Adjust the clip or thresholds.')
  }

  return <div className="page-wrap composer-page"><header className="page-header"><span className="eyebrow">LOCAL COMPOSER</span><h1>Create with sound</h1><p>Preview, describe and preflight before anything enters the fictional feed.</p></header>
    <section className="composer-section"><label className="field-label" htmlFor="post-text">Post text</label><textarea id="post-text" value={postText} onChange={(event) => setPostText(event.target.value)} maxLength={280} rows={3} /><div className="character-count">{postText.length} / 280</div>
      <fieldset className="media-selector"><legend>Media type</legend><button type="button" className={kind === 'reaction' ? 'selected' : ''} onClick={() => switchKind('reaction')} aria-pressed={kind === 'reaction'}><AudioLines size={20} /><span><strong>Sound reaction</strong><small>Compact · ≤ {config.durationLimit}s</small></span></button><button type="button" className={kind === 'voice' ? 'selected' : ''} onClick={() => switchKind('voice')} aria-pressed={kind === 'voice'}><Mic2 size={20} /><span><strong>Voice post</strong><small>Full-width · ≤ 140s</small></span></button></fieldset>
    </section>
    {kind === 'reaction' && <section className="composer-section"><span className="field-label">Sound</span><div className="composer-sounds">{SOUND_LIBRARY.map((item) => <button key={item.id} className={clip.id === item.id ? 'selected' : ''} onClick={() => { stop(); setClip({ ...item }); setSimulatedRecording(false) }}><span aria-hidden="true">{item.emoji}</span>{item.name}<small>{item.duration}s</small></button>)}</div></section>}
    <section className="composer-section"><div className="section-title-row"><h2>Preview & describe</h2><span className="origin-badge">NO AUTOPLAY</span></div>
      <div className="draft-player"><button className={kind === 'voice' ? 'voice-play' : 'sound-play'} onClick={() => isPlaying ? stop() : void audioController.play(clip)} aria-label={`${isPlaying ? 'Pause' : 'Preview'} ${clip.name}`}>{isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}</button><div><strong>{clip.name}</strong><span>{clip.duration}s · {clip.sizeKb} KB · {clip.lufs} LUFS{clip.audioUrl && !clip.audioUrl.startsWith('blob:') ? ' (measured)' : ' (approx.)'}</span></div><button className="secondary-button" onClick={() => stop()}><Square size={14} /> Stop</button></div>
      {clip.simulated && <p className="simulation-banner"><AlertCircle size={16} /> SIMULATED recording — no microphone audio was captured.</p>}
      <label className="field-label" htmlFor="transcript">Transcript or sound description <span>required</span></label><textarea id="transcript" rows={3} value={clip.transcript || clip.description} onChange={(event) => updateClip({ transcript: event.target.value, description: event.target.value })} placeholder="Describe what the sound communicates" />
      <div className="two-fields"><label>Loudness metadata (LUFS)<input type="number" value={clip.lufs} min="-60" max="0" onChange={(event) => updateClip({ lufs: Number(event.target.value) })} /></label><label>File size metadata (KB)<input type="number" value={clip.sizeKb} min="1" onChange={(event) => updateClip({ sizeKb: Number(event.target.value) })} /></label></div>
      <div className="ai-controls"><Toggle label="Declare AI-generated or cloned voice" checked={clip.aiDeclared} onChange={(value) => updateClip({ aiDeclared: value, aiLabel: value ? clip.aiLabel : false })} />{clip.aiDeclared && <Toggle label="Show AI audio label" description="EU AI Act Art. 50 design mapping; not a legal certification." checked={clip.aiLabel} onChange={(value) => updateClip({ aiLabel: value })} />}</div>
    </section>
    <section className="composer-section"><div className="section-title-row"><h2>Record audio</h2><span className="origin-badge">ON-DEVICE ONLY</span></div><p className="muted">Real capture starts only after an explicit permission explainer. If unavailable, use the clearly labeled simulated flow.</p>
      {!recording && !recordingExplainer && <div className="button-row"><button className="secondary-button" onClick={() => setRecordingExplainer(true)}><Mic2 size={17} /> Enable microphone</button><button className="text-button" onClick={useSimulatedRecording}>Use simulated recording</button></div>}
      {recordingExplainer && <div className="permission-explainer"><ShieldCheck size={22} /><div><strong>Allow local microphone capture?</strong><p>Your browser will ask permission. Audio stays in this tab and is never uploaded. Recording is capped at {maxRecord} seconds for this media type.</p><div className="button-row"><button className="primary-button" onClick={() => void beginRecording()}>Continue to browser permission</button><button className="secondary-button" onClick={() => setRecordingExplainer(false)}>Cancel</button></div></div></div>}
      {recording && <div className="recording-panel" role="status"><span className="recording-dot" /><strong>Recording</strong><span>0:{recordSeconds.toString().padStart(2, '0')} / {maxRecord}s</span><button className="primary-button" onClick={stopRecording}>Stop</button><button className="secondary-button" onClick={cancelRecording}>Cancel</button></div>}
      {recordError && <div className="error-panel" role="alert"><AlertCircle size={18} /><div><strong>Real capture unavailable</strong><p>{recordError}. You can continue with simulated audio.</p><button className="text-button" onClick={useSimulatedRecording}>Switch to simulated recording</button></div></div>}
    </section>
    <section className="composer-section"><div className="section-title-row"><h2>Demo scenarios</h2><span className="origin-badge">DETERMINISTIC</span></div><div className="scenario-buttons"><button onClick={() => scenario('pass')}><CheckCircle2 size={16} /> Harmless clip</button><button onClick={() => scenario('transcript')}>Missing transcript</button><button onClick={() => scenario('long')}>12 s clip</button><button onClick={() => scenario('abuse')}>SIMULATED abusive clip</button></div></section>
    <section className="composer-section playback-settings"><h2>Playback settings</h2><Toggle label="Captions and descriptions" checked={settings.captions} onChange={(value) => setSetting('captions', value)} /><Toggle label="Reduce waveform motion" checked={settings.reducedMotion} onChange={(value) => setSetting('reducedMotion', value)} /><Link to="/settings" className="text-link">Open all playback settings</Link></section>
    <div aria-live="polite" aria-atomic="true"><PreflightPanel result={result} /></div>
    <div className="publish-bar"><span>{result.decision === 'PASS' ? 'Ready for local feed' : result.decision === 'REVIEW' ? 'Will be held for review' : 'Will not publish'}</span><button className="primary-button" onClick={submit} disabled={result.decision === 'BLOCK'}>{result.decision === 'PASS' ? 'Publish locally' : result.decision === 'REVIEW' ? 'Submit for review' : 'Blocked'}</button></div>
  </div>
}
