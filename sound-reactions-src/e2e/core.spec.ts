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
