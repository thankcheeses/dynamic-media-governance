// Writes illustrated portrait avatars for the fictional accounts to public/avatars/*.svg.
// These are deliberately drawings, not photos: every account in the prototype is fictional.
// Run: node scripts/generate-avatars.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'avatars')

const SKIN = {
  porcelain: '#F6D9C6',
  light: '#EBC3A4',
  tan: '#D49E78',
  golden: '#C68A5E',
  brown: '#A0663F',
  deep: '#6E4429',
}
const HAIR = {
  black: '#1E1A18',
  espresso: '#3B2A22',
  brown: '#5C3B28',
  auburn: '#8A4A2C',
  blonde: '#D2A65E',
  grey: '#9C9690',
}

const PEOPLE = [
  { id: 'mc', bg: '#E9D7C4', skin: 'light', hair: 'black', style: 'bob', shirt: '#2F3A4A' },
  { id: 'tm', bg: '#D6DFD3', skin: 'tan', hair: 'espresso', style: 'short', shirt: '#7A4B35', glasses: true },
  { id: 'ao', bg: '#E4D3DA', skin: 'deep', hair: 'black', style: 'buzz', shirt: '#C9733F' },
  { id: 'dc', bg: '#F0DCC8', skin: 'brown', hair: 'black', style: 'afro', shirt: '#3D5A4C' },
  { id: 'aw', bg: '#D4DCE6', skin: 'golden', hair: 'espresso', style: 'short', shirt: '#22303C', beard: true },
  { id: 'kv', bg: '#EED6CF', skin: 'tan', hair: 'auburn', style: 'long', shirt: '#8E3B46' },
  { id: 'jr', bg: '#E6DFC9', skin: 'golden', hair: 'black', style: 'curly', shirt: '#B4553A' },
  { id: 'so', bg: '#D9D3E6', skin: 'deep', hair: 'black', style: 'locs', shirt: '#2E5E6E', glasses: true },
  { id: 'cn', bg: '#DCE6D4', skin: 'brown', hair: 'espresso', style: 'bun', shirt: '#E07B4F' },
]

function hairBack(style, color) {
  switch (style) {
    case 'long': return `<path d="M27 52c0-22 12-34 33-34s33 12 33 34v44H27z" fill="${color}"/>`
    case 'bob': return `<path d="M30 54c0-21 11-32 30-32s30 11 30 32v20c0 4-3 6-6 6H36c-3 0-6-2-6-6z" fill="${color}"/>`
    case 'afro': return `<circle cx="60" cy="48" r="33" fill="${color}"/>`
    case 'locs': return `<path d="M31 50c0-20 12-30 29-30s29 10 29 30v38h-8V60h-4v32h-8V62h-4v30h-8V62h-4v30h-8V62h-4v26h-8z" fill="${color}"/>`
    default: return ''
  }
}

function hairFront(style, color) {
  switch (style) {
    case 'short': return `<path d="M38 48c0-14 9-22 22-22s22 8 22 22c-5-6-13-9-22-9s-17 3-22 9z" fill="${color}"/>`
    case 'buzz': return `<path d="M39 47c1-12 9-19 21-19s20 7 21 19c-6-4-13-6-21-6s-15 2-21 6z" fill="${color}" opacity="0.92"/>`
    case 'bob': return `<path d="M37 50c2-14 11-21 23-21s21 7 23 21c-8-3-14-9-17-14-5 8-16 13-29 14z" fill="${color}"/>`
    case 'long': return `<path d="M37 52c2-15 11-23 23-23s21 8 23 23c-9-2-17-8-21-15-4 8-13 13-25 15z" fill="${color}"/>`
    case 'afro': return `<path d="M38 50c2-12 10-18 22-18s20 6 22 18c-6-5-14-7-22-7s-16 2-22 7z" fill="${color}"/>`
    case 'curly': return `<g fill="${color}"><circle cx="44" cy="40" r="9"/><circle cx="54" cy="33" r="10"/><circle cx="66" cy="33" r="10"/><circle cx="76" cy="40" r="9"/><circle cx="60" cy="38" r="9"/></g>`
    case 'locs': return `<path d="M38 50c2-13 10-20 22-20s20 7 22 20c-7-4-14-6-22-6s-15 2-22 6z" fill="${color}"/>`
    case 'bun': return `<g fill="${color}"><circle cx="60" cy="20" r="10"/><path d="M38 50c2-14 10-21 22-21s20 7 22 21c-6-6-14-9-22-9s-16 3-22 9z"/></g>`
    default: return ''
  }
}

function portrait(p) {
  const skin = SKIN[p.skin]
  const hair = HAIR[p.hair]
  const shade = 'rgba(0,0,0,0.08)'
  const ink = '#2A211C'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="240" height="240">
  <rect width="120" height="120" fill="${p.bg}"/>
  ${hairBack(p.style, hair)}
  <path d="M22 120c2-20 18-31 38-31s36 11 38 31z" fill="${p.shirt}"/>
  <path d="M51 78h18v14c0 5-4 8-9 8s-9-3-9-8z" fill="${skin}"/>
  <path d="M51 86c5 3 13 3 18 0v-6H51z" fill="${shade}"/>
  <ellipse cx="38.5" cy="58" rx="4" ry="6" fill="${skin}"/>
  <ellipse cx="81.5" cy="58" rx="4" ry="6" fill="${skin}"/>
  <ellipse cx="60" cy="55" rx="22" ry="26" fill="${skin}"/>
  ${hairFront(p.style, hair)}
  ${p.beard ? `<path d="M40 60c2 14 10 22 20 22s18-8 20-22c-3 6-9 9-20 9s-17-3-20-9z" fill="${hair}" opacity="0.85"/>` : ''}
  <path d="M46 52q5-3 10 0M64 52q5-3 10 0" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.75"/>
  <circle cx="51" cy="58" r="2.1" fill="${ink}"/>
  <circle cx="69" cy="58" r="2.1" fill="${ink}"/>
  <path d="M59 61q-2 6 1 7" stroke="${shade}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M53 70q7 5 14 0" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.8"/>
  <circle cx="46" cy="66" r="3.5" fill="#E58C7A" opacity="0.18"/>
  <circle cx="74" cy="66" r="3.5" fill="#E58C7A" opacity="0.18"/>
  ${p.glasses ? `<g fill="none" stroke="${ink}" stroke-width="1.6" opacity="0.85"><circle cx="51" cy="58" r="6.5"/><circle cx="69" cy="58" r="6.5"/><path d="M57.5 58h5M44.5 57l-5-2M75.5 57l5-2"/></g>` : ''}
</svg>
`
}

mkdirSync(OUT, { recursive: true })
for (const p of PEOPLE) writeFileSync(join(OUT, `${p.id}.svg`), portrait(p))
console.log(`Wrote ${PEOPLE.length} avatars to ${OUT}`)
