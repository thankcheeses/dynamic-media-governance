/** The welcome tour's steps, in journey order (src/journey.ts). Plain language; each step names the page it opens. */
export interface TourStep {
  title: string
  body: React.ReactNode
  /** The page this step is about. The tour takes you there, so you never have to find it. */
  to?: string
  /** Element to highlight while this step is open. */
  spot?: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome! This is a pretend X',
    body: <>Everything here is fake and safe to tap. It shows how two new features could work: <b>moving GIF banners</b> on profiles and <b>sound reactions</b> on posts. Tap <b>Next</b> and the tour takes you to each one.</>,
  },
  {
    title: 'Sound reactions',
    body: <>See the round <b>▶</b> buttons under posts? Tap one to hear a short sound. <b>Nothing ever plays by itself</b>, and the words underneath say what it sounds like.</>,
    to: '/',
    spot: '.x-reaction',
  },
  {
    title: 'Moving banners',
    body: <>This is Dee’s profile. The banner is a real GIF that was checked for flashing first, and it stops while you scroll. The <b>⏸</b> button stops it any time, and <b>ⓘ</b> shows how it was checked.</>,
    to: '/u/deesaysso',
  },
  {
    title: 'Try your own GIF',
    body: <>This one is yours. Tap <b>Edit profile</b> to upload a GIF or search GIPHY. It gets checked first: <b>pass</b>, <b>warning</b> or <b>blocked</b>. <b>Make it yours</b> puts your own name and photo here. It all stays on your phone.</>,
    to: '/profile',
  },
  {
    title: 'Post a sound',
    body: <>Pick a sound or record your voice. Eight checks run as you go, and you see every result before anything is posted.</>,
    to: '/compose',
  },
  {
    title: 'Behind the scenes',
    body: <>This is where the rules live. Change a limit and the decisions change with it. Anything held for review waits here for a person, and every step lands in the <b>audit log</b>.</>,
    to: '/governance',
  },
  {
    title: 'That’s the tour',
    body: <>Every page ends with a <b>Next</b> card, so you can keep going on your own. The full written plan is in <b>tab 1, The proposal</b>, at the top of the page.</>,
  },
]
