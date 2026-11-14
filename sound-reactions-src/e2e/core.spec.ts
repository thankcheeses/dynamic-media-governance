import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('sound-reactions-tour-seen', '1') } catch { /* ignore */ }
    const Original = window.AudioContext
    const tracked = window as unknown as { __audioContexts: AudioContext[] }
    tracked.__audioContexts = []
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) { super(options); tracked.__audioContexts.push(this) }
    }
  })
  await page.goto('/')
})

test('no audio element or AudioContext runs after load and full scroll', async ({ page }) => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(400)
  const state = await page.evaluate(() => ({ audio: [...document.querySelectorAll('audio')].map((item) => item.paused), contexts: (window as unknown as { __audioContexts?: AudioContext[] }).__audioContexts?.length ?? 0 }))
  expect(state.audio.every(Boolean)).toBe(true)
  expect(state.contexts).toBe(0)
})

test('starting clip B stops clip A', async ({ page }) => {
  await page.getByRole('button', { name: 'Play Mm-hmm sound reaction, 2 s', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause Mm-hmm sound reaction, 2 s', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Play Applause sound reaction, 3 s', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Pause Applause sound reaction, 3 s', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play Mm-hmm sound reaction, 2 s', exact: true })).toBeVisible()
})

test('voice post and reaction controls have different accessible names', async ({ page }) => {
  await page.goto('/compare')
  await expect(page.getByRole('button', { name: 'Play voice post by @mayamakes', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play Applause sound reaction, 3 s', exact: true })).toBeVisible()
})

test('changing the duration threshold flips a decision', async ({ page }) => {
  await page.goto('/compose')
  await page.getByRole('button', { name: '12 s clip', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'BLOCK · BLOCKED' })).toBeVisible()
  await page.goto('/governance')
  await page.getByLabel('Reaction duration limit (s)').fill('12')
  await page.goto('/compose')
  await page.getByRole('button', { name: '12 s clip', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'PASS · PUBLISHED' })).toBeVisible()
})

test('report flow writes audit events', async ({ page }) => {
  await page.getByRole('button', { name: 'Play Mm-hmm sound reaction, 2 s', exact: true }).click()
  await page.getByRole('button', { name: 'Stop Mm-hmm sound reaction', exact: true }).click()
  await page.getByRole('button', { name: 'More sound reaction actions' }).first().click()
  await page.getByRole('button', { name: 'Report this sound reaction' }).click()
  await page.getByRole('button', { name: 'Submit local report' }).click()
  await page.goto('/audit')
  await expect(page.getByRole('listitem').getByText('reaction_reported', { exact: true })).toBeVisible()
  await expect(page.getByRole('listitem').getByText('playback_started', { exact: true })).toBeVisible()
  await expect(page.getByText(/post-1: Harassment/)).toBeVisible()
})

test('approving a held submission publishes it into the local feed', async ({ page }) => {
  await page.goto('/compose')
  await page.getByRole('button', { name: 'Missing transcript', exact: true }).click()
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page).toHaveURL(/governance/)
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.goto('/')
  await expect(page.getByText('A quieter way to add tone to the conversation.').first()).toBeVisible()
})

test('slide navigation works by keyboard', async ({ page }) => {
  await page.goto('/presentation')
  await expect(page.getByRole('heading', { name: 'Expressive by design. Silent by default.' })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: 'Separate what happened from what we hypothesize.' })).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('heading', { name: 'Expressive by design. Silent by default.' })).toBeVisible()
})

test('feed has no automatically detected serious accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const serious = results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  expect(serious).toEqual([])
})

test('soundboard filters by category and keeps favorites', async ({ page }) => {
  await page.getByRole('button', { name: 'Add sound reaction' }).first().click()
  await page.getByRole('button', { name: 'Game show', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Preview Level up sound reaction/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Preview Applause sound reaction/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add Level up to favorites' }).click()
  await page.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(page.getByRole('radio')).toHaveCount(1)
  await expect(page.getByRole('radio', { name: /Level up/ })).toBeVisible()
  const contexts = await page.evaluate(() => (window as unknown as { __audioContexts?: AudioContext[] }).__audioContexts?.length ?? 0)
  expect(contexts).toBe(0)
})

test('presentation 3D intro starts no audio until "Hear it" is pressed', async ({ page }) => {
  await page.goto('/presentation')
  await page.waitForTimeout(1200)
  expect(await page.evaluate(() => (window as unknown as { __audioContexts?: AudioContext[] }).__audioContexts?.length ?? 0)).toBe(0)
  await page.getByRole('button', { name: 'Hear the applause sound reaction' }).click()
  await expect(page.getByRole('button', { name: 'Stop the applause demo' })).toBeVisible()
})

test('tapping a name in the feed opens that profile with its dynamic header, silently', async ({ page }) => {
  await page.getByRole('link', { name: 'Maya Chen, view profile' }).click()
  await expect(page).toHaveURL(/\/u\/mayamakes$/)
  const video = page.locator('.dynamic-header video')
  await expect(video).toHaveJSProperty('muted', true)
  expect(await video.getAttribute('autoplay')).toBeNull()
  await expect(page.getByRole('button', { name: 'Pause header animation' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __audioContexts?: AudioContext[] }).__audioContexts?.length ?? 0)).toBe(0)
})

test('the owner’s Tenor pick is scanned in the browser, then plays through the capped canvas, credited', async ({ page }) => {
  // Tenor is not reachable from the test environment; serve the calm local GIF in its place.
  await page.route(/tenor\.com\/.*\.gif$/, (route) => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'image/gif', path: 'public/headers/clay-orbit.gif' }))
  await page.getByRole('link', { name: 'Dee Carter, view profile' }).click()
  await expect(page).toHaveURL(/\/u\/deesaysso$/)
  const header = page.locator('.dynamic-header')
  await expect(header.locator('canvas')).toBeVisible({ timeout: 20000 })
  await expect(header.locator('video')).toHaveCount(0)
  await expect(header.getByRole('link', { name: 'via Tenor' })).toHaveAttribute('href', /tenor\.com/)
  await expect(page.getByRole('button', { name: 'Pause header animation' })).toBeVisible()
  await page.getByRole('button', { name: 'About this header' }).click()
  await expect(page.getByText(/Red flashes/)).toBeVisible()
})

test('an unmeasured hosted GIF is scanned in the browser before it plays', async ({ page }) => {
  // GIPHY is not reachable from the test environment; serve the calm local GIF in its place.
  await page.route(/giphy\.com\/media\/.*\.gif$/, (route) => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'image/gif', path: 'public/headers/clay-orbit.gif' }))
  await page.getByRole('link', { name: 'Jordan Reyes, view profile' }).click()
  await expect(page).toHaveURL(/\/u\/jreyescooks$/)
  const header = page.locator('.dynamic-header')
  await expect(header.locator('canvas')).toBeVisible({ timeout: 20000 })
  await expect(header.locator('video')).toHaveCount(0)
  await expect(header.getByRole('link', { name: 'via GIPHY' })).toHaveAttribute('href', /giphy\.com\/gifs\//)
  await page.getByRole('button', { name: 'About this header' }).click()
  await expect(page.getByText(/fetched and scanned in your browser/)).toBeVisible()
})

test('"Make it yours" puts the visitor’s name on the owner profile, locally, without a verified badge', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Make it yours' }).click()
  const dialog = page.getByRole('dialog', { name: 'Make it yours' })
  await dialog.getByLabel('Name', { exact: true }).fill('Sam Tester')
  await dialog.getByLabel('Handle').fill('sam tests!')
  await dialog.getByLabel('Bio').fill('Just here to try the GIF banners.')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sam Tester' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 }).getByText('Verified account')).toHaveCount(0)
  await expect(page.locator('.x-profile-info .x-handle')).toHaveText('@samtests')
  await expect(page.getByText('Your profile, on this device only')).toBeVisible()
  // The owner's posts and the account menu follow the new identity, and it survives a reload.
  await expect(page.getByRole('article', { name: 'Post by Sam Tester' }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Sam Tester' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit my details' }).click()
  await page.getByRole('button', { name: 'Use the demo owner again' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /B\. Baynard-Malone/ })).toBeVisible()
})

test('the header studio hard-blocks a strobe and keeps the current header', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByRole('radio', { name: /Strobe party/ }).click()
  await page.getByRole('button', { name: 'Run PEA scan' }).click()
  await expect(page.getByText('HARD BLOCK', { exact: true })).toBeVisible()
  await expect(page.getByText('This header can’t be published')).toBeVisible()
})

test('GIPHY search shows still frames and scans a picked GIF before it can play', async ({ page }) => {
  const gif = 'public/headers/clay-orbit.gif'
  const cors = { 'access-control-allow-origin': '*' }
  await page.route('https://api.giphy.com/**', (route) => route.fulfill({
    headers: cors, contentType: 'application/json',
    body: JSON.stringify({ data: [{ id: 'calm1', title: 'Calm orbit', url: 'https://giphy.com/gifs/calm1', images: { downsized: { url: 'https://media.giphy.com/media/calm1/giphy-downsized.gif', width: '1200', height: '400' }, fixed_width_still: { url: 'https://media.giphy.com/media/calm1/200w_s.gif' } } }] }),
  }))
  await page.route('https://media.giphy.com/**', (route) => route.fulfill({ headers: cors, contentType: 'image/gif', path: gif }))
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByLabel('GIPHY API key').fill('test-key')
  await page.getByRole('button', { name: 'Save key' }).click()
  await expect(page.getByRole('button', { name: 'Scan Calm orbit' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('sound-reactions-giphy-key'))).toBe('test-key')
  await page.getByRole('button', { name: 'Scan Calm orbit' }).click()
  await expect(page.getByText('PASS', { exact: true })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Use this header' }).click()
  // Rule 14: a GIF that plays from GIPHY keeps its attribution on the banner itself.
  await expect(page.locator('.dynamic-header').getByRole('link', { name: 'via GIPHY' })).toHaveAttribute('href', 'https://giphy.com/gifs/calm1')
  await page.getByRole('button', { name: 'About this header' }).click()
  await expect(page.getByText('A GIF picked from GIPHY')).toBeVisible()
})

test('a hosted sample chosen in the studio keeps its identity: Tenor credit and provenance, and it survives a reload', async ({ page }) => {
  // Regression: a hosted pick published from the studio used to be stored as an "upload", which lost it on reload,
  // dropped the "via" credit from the banner, and described a Tenor GIF as picked from GIPHY.
  await page.route(/tenor\.com\/.*\.gif$/, (route) => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'image/gif', path: 'public/headers/clay-orbit.gif' }))
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByRole('radio', { name: /SpongeBob at the computer/ }).click()
  await expect(page.getByText('PASS', { exact: true })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Use this header' }).click()
  const header = page.locator('.dynamic-header')
  await expect(header.getByRole('link', { name: 'via Tenor' })).toHaveAttribute('href', /tenor\.com/)
  await expect(header.locator('canvas')).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'About this header' }).click()
  await expect(page.getByText(/A GIF playing from Tenor/)).toBeVisible()
  await page.keyboard.press('Escape')
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('sound-reactions-demo-v3') ?? '{}')) as { state: { profileHeader: unknown } }
  expect(saved.state.profileHeader).toMatchObject({ kind: 'preset', presetId: 'spongebob-computer', decision: 'PASS', chosen: true })
  await page.reload()
  await expect(page.locator('.dynamic-header').getByRole('link', { name: 'via Tenor' })).toBeVisible({ timeout: 20000 })
})

test('the header info tour explains the scan without cluttering the banner', async ({ page }) => {
  // GIPHY is not reachable from the test environment; serve the calm local GIF in its place.
  await page.route(/giphy\.com\/media\/.*\.gif$/, (route) => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'image/gif', path: 'public/headers/clay-orbit.gif' }))
  await page.goto('/profile')
  await expect(page.locator('.header-chip')).toHaveCount(0)
  await page.getByRole('button', { name: 'About this header' }).click({ timeout: 20000 })
  await expect(page.getByRole('heading', { name: 'Scanned before it went live' })).toBeVisible()
  await expect(page.getByText(/fetched and scanned in your browser/)).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('link', { name: 'GIPHY' })).toHaveAttribute('href', /giphy\.com\/gifs\//)
  for (const title of ['Within the limits', 'How it plays', 'Under the hood']) {
    await page.getByRole('button', { name: /Next/ }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('the welcome tour opens on a first visit, links back to the proposal, and stays closed after', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('sound-reactions-tour-seen'))
  await page.addInitScript(() => { if (!sessionStorage.getItem('first')) { sessionStorage.setItem('first', '1'); localStorage.removeItem('sound-reactions-tour-seen') } })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome! This is a pretend X' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: /The proposal/ })).toHaveAttribute('href', '../')
  await page.getByRole('button', { name: 'Close tour' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome! This is a pretend X' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Take the tour' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome! This is a pretend X' })).toBeVisible()
})

test('the tour drives to each page, resumes where it was closed, and every page ends with a Next card', async ({ page }) => {
  await page.getByRole('button', { name: 'Take the tour' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sound reactions' })).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/\/u\/deesaysso$/)
  await expect(page.getByRole('heading', { name: 'Moving banners' })).toBeVisible()
  await page.getByRole('button', { name: 'Close tour' }).click()
  // Reopening picks up at the same step rather than starting over.
  await page.getByRole('button', { name: 'Take the tour' }).click()
  await expect(page.getByText('Step 3 of 7')).toBeVisible()
  await page.getByRole('button', { name: 'Close tour' }).click()
  // The foot of the page says where to go next, and the chain continues from there.
  const next = page.getByRole('navigation', { name: 'Next in the walkthrough' })
  await expect(next).toContainText('Try your own banner')
  await next.getByRole('link').click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('navigation', { name: 'Next in the walkthrough' })).toContainText('Post a sound yourself')
})

test('an X archive zip is read in the browser, fills the tabs, makes no outside requests, and clears cleanly', async ({ page, baseURL }) => {
  const { zipSync, strToU8 } = await import('fflate')
  const ytd = (name: string, rows: unknown[]) => strToU8(`window.YTD.${name}.part0 = ${JSON.stringify(rows)}`)
  // 1×1 PNG, so the Media tab has a real image from the archive.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  const zip = zipSync({
    'data/account.js': ytd('account', [{ account: { email: 'hidden@example.com', username: 'archivetester', accountId: '42', createdAt: 'Mon Mar 02 10:00:00 +0000 2015', accountDisplayName: 'Archive Tester' } }]),
    'data/profile.js': ytd('profile', [{ profile: { description: { bio: 'Imported from a zip, on this device.', website: '', location: 'Houston' }, avatarMediaUrl: 'https://pbs.twimg.com/profile_images/1/me.png', headerMediaUrl: '' } }]),
    'data/tweets.js': ytd('tweets', [
      { tweet: { id_str: '100', full_text: 'My first archived post', created_at: 'Wed Oct 10 20:19:24 +0000 2018', favorite_count: '5', retweet_count: '1', entities: { urls: [] } } },
      { tweet: { id_str: '101', full_text: '@friend agreed', created_at: 'Thu Oct 11 09:00:00 +0000 2018', in_reply_to_screen_name: 'friend', entities: { urls: [] } } },
      { tweet: { id_str: '102', full_text: 'a picture https://t.co/p', created_at: 'Fri Oct 12 09:00:00 +0000 2018', entities: { urls: [], media: [{ url: 'https://t.co/p' }] }, extended_entities: { media: [{ type: 'photo', media_url_https: 'https://pbs.twimg.com/media/pic.png', ext_alt_text: 'A tiny square' }] } } },
    ]),
    'data/like.js': ytd('like', [{ like: { tweetId: '7', fullText: 'Something I liked', expandedUrl: 'https://x.com/i/web/status/7' } }]),
    'data/profile_media/42-me.png': new Uint8Array(png),
    'data/tweets_media/102-pic.png': new Uint8Array(png),
    'data/direct-messages.js': ytd('direct_messages', [{ dmConversation: { messages: [{ text: 'never shown' }] } }]),
  })

  // The only hosts the page may talk to are the ones the privacy notice names (GIF hosts for banners). Never X.
  const allowed = /^(blob:|data:)|^https:\/\/([a-z0-9-]+\.)?(giphy|tenor)\.com\//
  const outside: string[] = []
  page.on('request', (request) => { const url = request.url(); if (!url.startsWith(baseURL!) && !allowed.test(url)) outside.push(url) })

  await page.goto('/me')
  await expect(page.getByRole('heading', { name: 'See this with your own posts' })).toBeVisible()
  await page.getByRole('button', { name: 'Preview with my X archive' }).click()
  await expect(page.getByRole('dialog', { name: 'Preview with your X archive' })).toBeVisible()
  await page.getByTestId('archive-files').setInputFiles({ name: 'twitter-archive.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) })

  await expect(page).toHaveURL(/\/me$/)
  await expect(page.getByRole('heading', { level: 1, name: /Archive Tester/ })).toBeVisible()
  await expect(page.getByText('@archivetester').first()).toBeVisible()
  await expect(page.getByText('From your X archive · on this device only')).toBeVisible()
  await expect(page.getByText('Imported from a zip, on this device.')).toBeVisible()
  await expect(page.locator('.x-profile-avatar img')).toBeVisible()
  // Posts tab: top-level posts only, newest first; the reply is not here.
  await expect(page.getByRole('article', { name: 'Post by Archive Tester' })).toHaveCount(2)
  await expect(page.getByText('My first archived post')).toBeVisible()
  await expect(page.getByText('@friend agreed')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Replies' }).click()
  await expect(page.getByText('@friend agreed')).toBeVisible()
  await expect(page.getByText('Replying to @friend')).toBeVisible()
  await page.getByRole('tab', { name: 'Media' }).click()
  await expect(page.getByRole('img', { name: 'A tiny square' })).toBeVisible()
  await page.getByRole('tab', { name: 'Likes' }).click()
  await expect(page.getByText('Something I liked')).toBeVisible()
  await page.getByRole('tab', { name: 'Highlights' }).click()
  await expect(page.getByText('X does not include Highlights in the archive.')).toBeVisible()
  // Pin a post to Highlights from its menu.
  await page.getByRole('tab', { name: 'Posts' }).click()
  await page.getByRole('button', { name: 'More options for @archivetester post' }).first().click()
  await page.getByRole('button', { name: 'Add to Highlights' }).click()
  await page.getByRole('tab', { name: 'Highlights' }).click()
  await expect(page.getByRole('article', { name: 'Post by Archive Tester' })).toHaveCount(1)
  // The imported posts also sit in the home timeline (navigating in-app: a reload drops the import by design).
  await page.getByRole('link', { name: 'Sound Reactions home' }).first().click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('My first archived post')).toBeVisible()
  // Nothing from the archive is written to storage, and nothing left the device.
  const stored = await page.evaluate(() => Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? '').join(''))
  expect(stored).not.toContain('archivetester')
  expect(stored).not.toContain('hidden@example.com')
  expect(outside, `requests to other hosts: ${outside.join(', ')}`).toEqual([])
  // Clear my import returns to the demo profile and empties the timeline of archive posts.
  await page.goBack()
  await expect(page).toHaveURL(/\/me$/)
  await page.getByRole('button', { name: 'Clear my import' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { level: 1, name: /B\. Baynard-Malone/ })).toBeVisible()
  await page.getByRole('link', { name: 'Sound Reactions home' }).first().click()
  await expect(page.getByText('My first archived post')).toHaveCount(0)
  // And a reload after an import starts from nothing: /me shows the landing again.
  await page.goto('/me')
  await expect(page.getByRole('heading', { name: 'See this with your own posts' })).toBeVisible()
})

/** A 16-bit mono PCM WAV of a 440 Hz sine at the given peak, generated in the test. */
function wav(seconds: number, amplitude = 0.2, rate = 8000): Buffer {
  const n = Math.round(seconds * rate)
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(amplitude * 32767 * Math.sin((2 * Math.PI * 440 * i) / rate)), i * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
  header.write('data', 36); header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

test('a sound uploaded from the device is measured here, must be described, and becomes a reaction', async ({ page }) => {
  await page.getByRole('button', { name: 'Add sound reaction' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add a sound reaction' })
  await page.getByTestId('sound-upload').setInputFiles({ name: 'air-horn.wav', mimeType: 'audio/wav', buffer: wav(1) })
  await expect(dialog.getByRole('radio', { name: /air horn/ })).toHaveAttribute('aria-checked', 'true')
  await expect(dialog.getByText(/about -17\.\d LUFS|about -18 LUFS/)).toBeVisible()
  await expect(dialog.getByText(/not EBU R128/)).toBeVisible()
  await expect(dialog.getByText(/copyright check is SIMULATED/)).toBeVisible()
  const add = dialog.getByRole('button', { name: 'Add air horn reaction' })
  await expect(add).toBeDisabled()
  await dialog.getByLabel(/Describe the sound/).fill('A short air horn blast')
  await add.click()
  await expect(page.getByText('air horn reaction added')).toBeVisible()
  await expect(page.locator('.x-reaction').filter({ hasText: 'air horn' }).first()).toBeVisible()
  // The reaction's audio is a blob in this tab; nothing about it is persisted.
  const stored = await page.evaluate(() => localStorage.getItem('sound-reactions-demo-v3') ?? '')
  expect(stored).not.toContain('air horn')
})

test('an uploaded clip over the reaction cap is blocked by the duration check in the composer', async ({ page }) => {
  await page.goto('/compose')
  await page.getByTestId('composer-sound-upload').setInputFiles({ name: 'long-clip.wav', mimeType: 'audio/wav', buffer: wav(10) })
  await expect(page.getByText(/long clip loaded from your device/)).toBeVisible()
  await expect(page.getByText(/measured in your browser, not EBU R128/).first()).toBeVisible()
  await expect(page.getByText('10s submitted')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Blocked' })).toBeDisabled()
})

test('low-power mode pauses audio and keeps the app on screen', async ({ page }) => {
  // Regression: a re-created stop() in a low-power effect once looped setState until React unmounted everything.
  await page.goto('/settings')
  await page.getByText('Low-power mode', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Sound Reactions home' }).first().click()
  await expect(page.getByRole('article').first()).toBeVisible()
  await page.getByRole('link', { name: 'Maya Chen, view profile' }).click()
  // The header shows a still frame: no pause button, and the ⓘ panel says why.
  await expect(page.getByRole('button', { name: 'Pause header animation' })).toHaveCount(0)
  await page.getByRole('button', { name: 'About this header' }).click()
  await page.getByRole('button', { name: /Next/ }).click()
  await page.getByRole('button', { name: /Next/ }).click()
  await expect(page.getByRole('heading', { name: 'How it plays' })).toBeVisible()
  await expect(page.getByText(/low-power mode is on/).first()).toBeVisible()
})

test('the post box on the timeline posts text with an emoji from the full picker', async ({ page }) => {
  const box = page.getByRole('form', { name: 'Write a post' })
  await expect(box.getByRole('button', { name: 'Post', exact: true })).toBeDisabled()
  await box.getByLabel('Post text').fill('first words')
  await box.getByRole('button', { name: 'Add emoji' }).click()
  const panel = page.getByRole('dialog', { name: 'Emoji' })
  await expect(panel.getByRole('tab')).toHaveCount(9)
  await panel.getByRole('tab', { name: 'Flags' }).click()
  await expect(panel.getByRole('button', { name: 'flag Japan', exact: true })).toBeVisible()
  await panel.getByLabel('Search emoji').fill('clapping')
  await panel.getByRole('button', { name: 'clapping hands', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(box.getByLabel('Post text')).toHaveValue('first words👏')
  await box.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.getByRole('article').first()).toContainText('first words👏')
  await expect(box.getByLabel('Post text')).toHaveValue('')
  // It is saved on this device only, and survives a reload.
  await page.reload()
  await expect(page.getByRole('article').first()).toContainText('first words👏')
  await page.goto('/audit')
  await expect(page.getByRole('listitem').getByText('text_post_published', { exact: true })).toBeVisible()
})

test('the composer posts text only, and carries a draft over from the timeline', async ({ page }) => {
  await page.getByRole('form', { name: 'Write a post' }).getByLabel('Post text').fill('draft from the timeline')
  await page.getByRole('link', { name: 'Add a sound or voice note' }).click()
  await expect(page).toHaveURL(/compose/)
  await expect(page.getByLabel('Post text')).toHaveValue('draft from the timeline')
  await page.getByRole('button', { name: /Text only/ }).click()
  await expect(page.getByRole('heading', { name: 'Preview & describe' })).toBeHidden()
  await page.getByRole('button', { name: 'Add emoji' }).click()
  await page.getByRole('dialog', { name: 'Emoji' }).getByRole('button', { name: 'grinning face', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Post locally' }).click()
  await expect(page.getByRole('article').first()).toContainText('draft from the timeline😀')
})
