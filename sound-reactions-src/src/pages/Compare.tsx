import { AudioLines, Check, Mic2, X } from 'lucide-react'
import { SoundReactionChip, VoicePostPlayer } from '../components/AudioClip'
import { SOUND_LIBRARY, VOICE_DEMO } from '../data'
import type { Post } from '../types'

const demoPost: Post = { id: 'compare', author: 'B. Baynard-Malone', handle: '@baynardmalone', initials: 'BB', timestamp: 'now', body: '', reaction: { ...SOUND_LIBRARY[0], count: 1 }, replyCount: 0, repostCount: 0, likeCount: 0, viewCount: 0, following: true }

export default function Compare() {
  return <div className="page-wrap"><header className="page-header"><span className="eyebrow">INTERACTION MODEL</span><h1>Voice posts ≠ sound reactions</h1><p>Different authorship, duration, visual weight and accessible names prevent two audio formats from collapsing into one.</p></header>
    <div className="comparison-grid">
      <section className="comparison-column voice-column"><div className="comparison-title"><Mic2 size={22} /><div><span>AUTHOR-OWNED</span><h2>Voice post</h2></div></div><VoicePostPlayer clip={VOICE_DEMO} handle="@mayamakes" /><dl><div><dt>Purpose</dt><dd>Primary post content</dd></div><div><dt>Duration</dt><dd>Up to 140 seconds</dd></div><div><dt>Control</dt><dd>Full-width player in post body</dd></div><div><dt>Accessible name</dt><dd>“Play voice post by @mayamakes”</dd></div></dl></section>
      <section className="comparison-column reaction-column"><div className="comparison-title"><AudioLines size={22} /><div><span>POST-ATTACHED</span><h2>Sound reaction</h2></div></div><SoundReactionChip reaction={demoPost.reaction!} post={demoPost} /><dl><div><dt>Purpose</dt><dd>Compact response to a post</dd></div><div><dt>Duration</dt><dd>Up to 8 seconds</dd></div><div><dt>Control</dt><dd>Chip in the reactions area</dd></div><div><dt>Accessible name</dt><dd>“Play Applause sound reaction, 3 s”</dd></div></dl></section>
    </div>
    <section className="comparison-rules"><h2>Shared safety contract</h2><div><p><Check size={17} /> Gesture-only playback</p><p><Check size={17} /> One active stream</p><p><Check size={17} /> Transcript or description</p><p><Check size={17} /> Visible progress + stop</p><p><X size={17} /> Never autoplay</p><p><X size={17} /> Never audio-only meaning</p></div></section>
  </div>
}
