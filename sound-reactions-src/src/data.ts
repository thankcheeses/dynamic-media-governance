import type { AppSettings, Clip, GovernanceConfig, Post, SoundCategory } from './types'

import manifest from './audio-manifest.json'

type Measured = { duration: number; sizeKb: number; lufs: number | null; truePeak: number | null }
const generated = manifest as Record<string, Measured>

/**
 * Sounds generated with ElevenLabs live in public/audio and are listed in
 * src/audio-manifest.json with measured duration, size and loudness. A sound
 * without a generated file falls back to the in-browser synthesizer.
 */
function withAudio(clip: Clip): Clip {
  const id = clip.soundId ?? clip.id
  const file = generated[id]
  if (!file) return clip
  return {
    ...clip,
    audioUrl: `${import.meta.env.BASE_URL}audio/${id}.mp3`,
    duration: file.duration,
    sizeKb: file.sizeKb,
    lufs: file.lufs ?? clip.lufs,
    aiDeclared: true,
    aiLabel: true,
  }
}

export const HAS_GENERATED_AUDIO = Object.keys(generated).length > 0

const sound = (id: string, name: string, category: SoundCategory, duration: number, emoji: string, description: string, transcript: string, sizeKb: number): Clip =>
  withAudio({ id, soundId: id, name, category, kind: 'reaction', duration, description, transcript, emoji, sizeKb, lufs: -16, aiDeclared: false, aiLabel: false, abuse: false, copyright: false })

// Order of the first six is load-bearing: seed posts and the composer index into it.
export const SOUND_LIBRARY: Clip[] = [
  sound('applause', 'Applause', 'Hype', 3, '👏', 'A warm burst of hand claps that tapers softly.', '[Applause: clapping for three seconds]', 74),
  sound('side-eye', 'Side-eye', 'Reactions', 2, '👀', 'Two sly, descending notes: a playful “really?”', '[Two descending notes]', 48),
  sound('laughter', 'Laughter', 'Comedy', 3, '😂', 'Friendly laughter, light and warm.', '[Laughter]', 82),
  sound('gasp', 'Gasp', 'Reactions', 2, '😮', 'A quick, surprised gasp.', '[Quick surprised gasp]', 56),
  sound('mm-hmm', 'Mm-hmm', 'Reactions', 2, '💬', 'A warm two-note hum of agreement.', '[Mm-hmm: a hum of agreement]', 44),
  sound('tiny-violin', 'Tiny violin', 'Sad', 4, '🎻', 'A tiny, melodramatic violin lament.', '[Tiny violin plays a sad phrase]', 112),
  sound('airhorn', 'Airhorn', 'Hype', 2, '📣', 'Three bright, celebratory air horn blasts.', '[Air horn: three blasts]', 40),
  sound('drumroll', 'Drumroll', 'Hype', 3, '🥁', 'A suspenseful snare roll ending in a cymbal crash.', '[Drumroll, then cymbal crash]', 60),
  sound('slow-clap', 'Slow clap', 'Hype', 4, '🙌', 'One person slow clapping, building appreciation.', '[Slow clapping]', 60),
  sound('record-scratch', 'Record scratch', 'Reactions', 2, '💿', 'A record scratch that stops everything.', '[Record scratch, then silence]', 36),
  sound('rimshot', 'Rimshot', 'Comedy', 2, '🎤', 'Ba-dum-tss: the punchline drum sting.', '[Rimshot: ba-dum-tss]', 30),
  sound('dramatic-boom', 'Dramatic boom', 'Comedy', 2, '💥', 'A deep cinematic boom for a big reveal.', '[Deep dramatic boom]', 40),
  sound('crickets', 'Crickets', 'Comedy', 4, '🦗', 'Crickets chirping in an awkward silence.', '[Crickets chirping]', 60),
  sound('sad-trombone', 'Sad trombone', 'Sad', 3, '🎺', 'Wah wah wah wahhh: a comedic letdown.', '[Sad trombone, four falling notes]', 50),
  sound('correct-ding', 'Correct', 'Game show', 1.5, '✅', 'A bright game show “correct answer” ding.', '[Correct answer ding]', 24),
  sound('wrong-buzzer', 'Wrong', 'Game show', 1.5, '❌', 'A playful game show “wrong answer” buzz.', '[Wrong answer buzzer]', 24),
  sound('cash-register', 'Cha-ching', 'Game show', 2, '💰', 'A cash register cha-ching.', '[Cash register cha-ching]', 36),
  sound('level-up', 'Level up', 'Game show', 2, '⬆️', 'A rising retro video game level-up jingle.', '[8-bit level-up jingle]', 36),
]

export const SOUND_CATEGORIES: SoundCategory[] = ['Hype', 'Reactions', 'Comedy', 'Sad', 'Game show']

export const VOICE_DEMO: Clip = withAudio({
  id: 'voice-demo', soundId: 'voice-demo', name: 'Voice post', kind: 'voice', duration: 12,
  description: 'A short spoken design critique about leaving room for silence.',
  transcript: '[Fictional voice post] Design critique, out loud. The best reactions leave room for silence. A sound should add tone to a conversation, not take it over. So press play if you want it, and read along if you don’t.',
  emoji: '🎙️', sizeKb: 188, lufs: -18, aiDeclared: true, aiLabel: true, abuse: false, copyright: false,
})

export const DEFAULT_SETTINGS: AppSettings = {
  muted: false, volume: 0.7, captions: true, reducedMotion: false,
  dataSaver: false, lowPower: false, theme: 'lights-out',
}

export const DEFAULT_CONFIG: GovernanceConfig = {
  durationLimit: 8, voiceDurationLimit: 140, sizeLimit: 256,
  loudnessMin: -20, loudnessMax: -15, rateLimit: 5,
  policies: { duration: 'BLOCK', size: 'BLOCK', transcript: 'REVIEW', loudness: 'REVIEW', rate: 'REVIEW', abuse: 'REVIEW', copyright: 'BLOCK', synthetic: 'REVIEW' },
}

export const SEED_POSTS: Post[] = [
  {
    id: 'post-1', author: 'B. Baynard-Malone', handle: '@baynardmalone', initials: 'BB', timestamp: '18m', verified: true, topics: ['sound', 'design'],
    body: 'A sound reaction should add tone without demanding attention. Press play if you want it. Read the description if you don’t.',
    reaction: { ...SOUND_LIBRARY[4], id: 'reaction-post-1', count: 128 }, replyCount: 12, repostCount: 31, likeCount: 248, viewCount: 4200, following: true,
  },
  {
    id: 'post-2', author: 'Maya Chen', handle: '@mayamakes', initials: 'MC', timestamp: '42m', verified: true, topics: ['sound', 'design'],
    body: 'Design critique, out loud: the pause between ideas is part of the idea. This voice post is deliberately different from a reaction chip.',
    voice: VOICE_DEMO, reaction: { ...SOUND_LIBRARY[0], id: 'reaction-post-2', count: 64 }, replyCount: 8, repostCount: 17, likeCount: 193, viewCount: 2800, following: true,
  },
  {
    id: 'post-3', author: 'Theo Martins', handle: '@theotypes', initials: 'TM', timestamp: '1h', topics: ['accessibility'],
    body: 'My prototype passed its first keyboard-only test. Small celebration, no autoplay required.',
    reaction: { ...SOUND_LIBRARY[0], id: 'reaction-post-3', count: 91 }, replyCount: 5, repostCount: 22, likeCount: 317, viewCount: 5100, following: false,
  },
  {
    id: 'post-4', author: 'Ari Okafor', handle: '@ariexplains', initials: 'AO', timestamp: '2h', topics: ['safety'],
    body: 'Respectful disagreement is still disagreement. A useful reaction system should make room for both.',
    reaction: { ...SOUND_LIBRARY[1], id: 'reaction-post-4', count: 37 }, replyCount: 19, repostCount: 9, likeCount: 141, viewCount: 1900, following: false,
  },
  {
    id: 'post-5', author: 'Dee Carter', handle: '@deesaysso', initials: 'DC', timestamp: '1h', verified: true, topics: [],
    body: 'the group chat said 7pm. it is 9:40. everyone is “on the way” 🙃',
    reaction: { ...SOUND_LIBRARY[2], id: 'reaction-post-5', count: 412 }, replyCount: 57, repostCount: 88, likeCount: 1931, viewCount: 48200, following: true,
  },
  {
    id: 'post-6', author: 'Andre Wells', handle: '@andrewells', initials: 'AW', timestamp: '1h', verified: true, topics: [],
    body: 'Yes 😩🤣',
    quote: { author: 'Kiara Vibes', handle: '@kiaravibes', initials: 'KV', timestamp: '6h', verified: true, body: 'Which one should I open first? 🍷' },
    reaction: { ...SOUND_LIBRARY[3], id: 'reaction-post-6', count: 23 }, replyCount: 4, repostCount: 2, likeCount: 61, viewCount: 1240, following: true,
  },
  {
    id: 'post-7', author: 'Jordan Reyes', handle: '@jreyescooks', initials: 'JR', timestamp: '2h', topics: [],
    body: 'made the gumbo from my grandma’s recipe card and it actually tastes like hers 😭🍲',
    reaction: { ...SOUND_LIBRARY[0], id: 'reaction-post-7', count: 302 }, replyCount: 31, repostCount: 14, likeCount: 876, viewCount: 9100, following: false,
  },
  {
    id: 'post-8', author: 'Sam Okoye', handle: '@samoko', initials: 'SO', timestamp: '3h', topics: ['accessibility', 'sound'],
    body: 'If your app plays sound, give people the words too. Captions aren’t an extra. They’re the feature.',
    replyCount: 22, repostCount: 140, likeCount: 702, viewCount: 15600, following: false,
  },
  {
    id: 'post-9', author: 'Coach Nia', handle: '@coachnia', initials: 'CN', timestamp: '4h', topics: [],
    body: 'Game day tomorrow and I’ve been nervous since Tuesday. This is fine. Everything is fine 🦁',
    reaction: { ...SOUND_LIBRARY[5], id: 'reaction-post-9', count: 75 }, replyCount: 9, repostCount: 3, likeCount: 118, viewCount: 2700, following: true,
  },
]

export const EVENT_TYPES = ['media_submitted', 'preflight_started', 'check_completed', 'flagged', 'review_requested', 'decision_recorded', 'playback_started', 'reaction_reported', 'moderation_action']
