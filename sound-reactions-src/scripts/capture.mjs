import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('screenshots')
await fs.mkdir(root, { recursive: true })
await fs.mkdir('test-results', { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = { capturedAt: new Date().toISOString(), screens: [], consoleErrors: [], httpErrors: [], axe: [] }

for (const device of [
  { name: 'desktop', viewport: { width: 1280, height: 900 }, isMobile: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true },
]) {
  const context = await browser.newContext({ viewport: device.viewport, isMobile: device.isMobile, hasTouch: device.isMobile })
  const page = await context.newPage()
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`${device.name}: ${message.text()}`) })
  page.on('response', (response) => { if (response.status() >= 400) report.httpErrors.push(`${response.status()} ${response.url()}`) })
  const capture = async (name, route) => {
    await page.goto(`http://127.0.0.1:4173${route}`)
    await page.waitForTimeout(250)
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').reduce((sum, item) => sum + (item.transferSize || 0), 0))
    await page.screenshot({ path: path.join(root, `${device.name}-${name}.png`), fullPage: true })
    report.screens.push({ device: device.name, name, route, ...dimensions, horizontalOverflow: dimensions.document > dimensions.viewport, resourceTransferBytes: resources })
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    report.axe.push({ device: device.name, name, seriousOrCritical: axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) })) })
  }
  await capture('feed', '/')
  await page.getByRole('button', { name: 'Add sound reaction' }).first().click()
  await page.screenshot({ path: path.join(root, `${device.name}-picker.png`), fullPage: true })
  report.screens.push({ device: device.name, name: 'picker', route: '/', horizontalOverflow: false })
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await capture('composer', '/compose')
  await capture('comparison', '/compare')
  await page.goto('http://127.0.0.1:4173/compose')
  await page.getByRole('button', { name: 'Missing transcript', exact: true }).click()
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await page.waitForURL('**/governance')
  await capture('dashboard', '/governance')
  await capture('audit', '/audit')
  await capture('settings', '/settings')
  await capture('slides', '/presentation')
  await context.close()
}
await browser.close()
await fs.writeFile('test-results/capture-report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({ screenshots: report.screens.length, consoleErrors: report.consoleErrors, httpErrors: report.httpErrors, overflow: report.screens.filter((s) => s.horizontalOverflow), axeIssues: report.axe.filter((a) => a.seriousOrCritical.length) }, null, 2))
