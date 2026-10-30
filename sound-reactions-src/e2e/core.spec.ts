import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
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
  // The detail chip is hidden on narrow screens by design, so check it exists.
  await expect(page.locator('.header-chip', { hasText: /Via GIPHY · 15 fps/ })).toHaveCount(1)
})
