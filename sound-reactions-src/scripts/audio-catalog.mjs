// Prompts for build-time generation. Every sound is a generic effect described
// from scratch; none names or imitates a specific recording, show or meme clip.
// Nothing here can be aimed at a person (no booing, no mocking laughter).
export const SOUNDS = [
  // Hype
  { id: 'applause', seconds: 3, prompt: 'Warm enthusiastic applause from a small crowd, clapping that swells then tapers off, no voices' },
  { id: 'airhorn', seconds: 2, prompt: 'Celebratory stadium air horn, three short bright blasts, festive hype' },
  { id: 'drumroll', seconds: 3, prompt: 'Snare drum roll building suspense, ending with a single cymbal crash' },
  { id: 'slow-clap', seconds: 4, prompt: 'One person slow clapping in a quiet room, five deliberate claps getting slightly faster, appreciative' },
  // Reactions
  { id: 'gasp', seconds: 2, prompt: 'A single surprised human gasp, sharp quick inhale of shock, close microphone, no words' },
  { id: 'side-eye', seconds: 2, prompt: 'Playful cartoon suspicious sound, two descending wooden xylophone notes, sly and questioning' },
  { id: 'mm-hmm', seconds: 2, prompt: 'A warm human hum of agreement, "mm-hmm" two-note affirming hum with mouth closed, no other words' },
  { id: 'record-scratch', seconds: 2, prompt: 'Vinyl record scratch that abruptly stops the music, comedic halt, then silence' },
  // Comedy
  { id: 'laughter', seconds: 3, prompt: 'Friendly genuine group laughter, light and warm, a few people laughing together at a joke' },
  { id: 'rimshot', seconds: 2, prompt: 'Comedy drum rimshot, ba dum tss, snare snare cymbal, punchline sting' },
  { id: 'dramatic-boom', seconds: 2, prompt: 'Deep cinematic bass boom impact with short rumble tail, dramatic reveal hit' },
  { id: 'crickets', seconds: 4, prompt: 'Awkward silence, crickets chirping at night, sparse and quiet' },
  // Sad
  { id: 'tiny-violin', seconds: 4, prompt: 'A small solo violin playing a short exaggerated melodramatic sad phrase, comedic, thin and tiny' },
  { id: 'sad-trombone', seconds: 3, prompt: 'Sad trombone, four descending wah wah wah wahhh notes, comedic failure' },
  // Game show
  { id: 'correct-ding', seconds: 1.5, prompt: 'Game show correct answer chime, bright two-tone ding, cheerful' },
  { id: 'wrong-buzzer', seconds: 1.5, prompt: 'Game show wrong answer buzzer, short low electronic buzz, playful not harsh' },
  { id: 'cash-register', seconds: 2, prompt: 'Mechanical cash register ka-ching with drawer opening and bell' },
  { id: 'level-up', seconds: 2, prompt: '8-bit retro video game level up jingle, rising arpeggio, triumphant' },
]

export const VOICE = {
  id: 'voice-demo',
  voiceId: 'XB0fDUnXU5powFXDhCwa', // ElevenLabs stock voice "Charlotte" (conversational). Not a clone of any real person.
  text: 'Design critique, out loud. The best reactions leave room for silence. A sound should add tone to a conversation, not take it over. So press play if you want it, and read along if you don’t.',
}
