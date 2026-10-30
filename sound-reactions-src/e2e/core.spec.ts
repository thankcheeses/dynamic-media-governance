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

test('a hosted GIF header plays from its host through the capped canvas, muted and credited', async ({ page }) => {
  // Tenor is not reachable from the test environment; serve a local WebM in its place.
  await page.route('https://media.tenor.com/**', (route) => route.fulfill({ contentType: 'video/webm', path: 'public/headers/clay-orbit.webm' }))
  await page.getByRole('link', { name: 'Dee Carter, view profile' }).click()
  await expect(page).toHaveURL(/\/u\/deesaysso$/)
  const header = page.locator('.dynamic-header')
  await expect(header.locator('canvas')).toBeVisible()
  const video = header.locator('video')
  await expect(video).toHaveJSProperty('muted', true)
  expect(await video.getAttribute('autoplay')).toBeNull()
  await expect(header.getByRole('link', { name: 'via Tenor' })).toHaveAttribute('href', /tenor\.com/)
  await expect(page.getByRole('button', { name: 'Pause header animation' })).toBeVisible()
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
  await page.getByRole('button', { name: 'About this header' }).click()
  await expect(page.getByText('A GIF picked from GIPHY')).toBeVisible()
})

test('the header info tour explains the scan without cluttering the banner', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.locator('.header-chip')).toHaveCount(0)
  await page.getByRole('button', { name: 'About this header' }).click()
  await expect(page.getByRole('heading', { name: 'Scanned before it went live' })).toBeVisible()
  await expect(page.getByText(/The owner’s own pick, playing from/)).toBeVisible()
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
